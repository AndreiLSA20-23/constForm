import {
  Component,
  Input,
  OnInit,
  Inject,
  Optional,
  PLATFORM_ID,
  ChangeDetectorRef,
  OnDestroy
} from '@angular/core';
import {
  isPlatformBrowser,
  NgIf,
  NgForOf,
  NgClass,
  NgStyle,
  NgTemplateOutlet
} from '@angular/common';
import { BaseComponent } from '../../base/base/base.component';
import {
  DinFormJsonWorkerService,
  ElementData
} from '../../services/din-form-json-worker.service';
import { FormDataService } from '../../services/formdata.service';
import { HttpClient } from '@angular/common/http';
import {
  ReactiveFormsModule,
  FormGroup,
  FormArray,
  FormsModule,
  FormBuilder,
  AbstractControl,
  FormControl
} from '@angular/forms';
import { CpipSummaryPipe } from './cpip-summary.pipe';
import { SinglePageComponent } from './single-page/single-page.component';
import { PagenPageComponent } from './pagen-page/pagen-page.component';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import {HTTPFA} from '../../models/start-data';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dform',
  templateUrl: './dform.component.html',
  styleUrls: ['./dform.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule, 
    FormsModule,
    NgIf,
    NgForOf,
    NgClass,
    NgStyle,
    NgTemplateOutlet,
    PagenPageComponent,
    SinglePageComponent,
    CpipSummaryPipe,
    CommonModule
  ]
})
export class DformComponent extends BaseComponent implements OnInit, OnDestroy {
  @Input() override componentName!: string;

  public ssn: string = '';
  public bday: string = '';
  public param: string = 'default';   
  public maxItems: number = 15;
  public isEditing: boolean = false;
  public selectedIndex: number | null = null;
  public isSurveySaved: boolean = false;
  public isSingleFormView: boolean = true;
  public dformCurrentPage: number = 1;
  public totalPages: number = 1;

  public editForm!: FormGroup; // Форма для редактирования элемента (FormArray)
  private editFormBackup: any = null;
  private editFormSubscription: Subscription | null = null;
  private fallbackTimer: any;

  // Защита от повторной инициализации, если компонент монтируется заново
  private isInitialized = false;
  private originalFormRef: FormArray | FormGroup | null = null;
  isReady = false;


  

  constructor(
    @Inject(DinFormJsonWorkerService) dinFormService: DinFormJsonWorkerService,
    cd: ChangeDetectorRef,
    private formDataService: FormDataService,
    private http: HttpClient,
    private fb: FormBuilder,   
    private toastr: ToastrService,
    @Optional() @Inject('ssn') ssnToken: string,
    @Optional() @Inject('bday') bdayToken: string,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super(dinFormService, cd);

    // Инициализация ssn/bday/param
    if (isPlatformBrowser(this.platformId)) {
      this.ssn = ssnToken || localStorage.getItem('currentUserSSN') || '';
      this.bday = bdayToken || localStorage.getItem('currentUserBday') || '';
      this.param = localStorage.getItem('currentUserParam') || 'default';
    } else {
      this.ssn = ssnToken || '';
      this.bday = bdayToken || '';
       this.param = 'default'
    }



    this.editForm = this.fb.group({});
  }

  override ngOnInit(): void {
    if (!this.componentName) {
      console.error('[DformComponent] Component name is not provided.');
      return;
    }

    // Если уже инициализировали этот компонент (при повторном создании), не повторяем
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    // 1) Загружаем JSON-схему (BaseComponent подтянет и создаст this.form)
    this.loadRequirements();
    this.requirementsReady$.subscribe(() => {
    this.loadPrefillData();
    if (this.pageKeys?.length > 0) {
      this.totalPages = this.pageKeys.length;
      this.dformCurrentPage = 1;
    }

  });
  }



private loadPrefillData(): void {
  if (!this.ssn) {
    console.error('[DformComponent] Prefill: SSN not found.');
    return;
  }

  const url = HTTPFA.FORM_DATA(this.componentName, this.ssn, this.bday, this.param);

  //console.log('[DformComponent] Loading prefill data from:', url);

  // 1. Ставим таймер на 10с. Если ответа не будет, покажем пустую форму
  this.fallbackTimer = setTimeout(() => {
    console.warn('[DformComponent] Prefill request timed out — showing blank form.');
    // (не обязательно) Очищаем/сбрасываем форму:
    if (this.form instanceof FormGroup) {
      // this.form.reset();
      // Или оставляем как есть
    } else if (this.form instanceof FormArray) {
      // while (this.form.length > 0) {
      //   this.form.removeAt(0);
      // }
    }
    this.isReady = true;  // Разрешаем рендер
    this.cd.detectChanges();
  }, 10000); // 10000 мс = 10 сек. Можно 5000 (5 сек), как пожелаете.

  this.http.get(url).subscribe({
    next: (response: any) => {
      // Раз пришёл ответ — снимаем таймер
      clearTimeout(this.fallbackTimer);

      // 2. Проверяем, есть ли вообще что-то в response.data
      if (!response || !response.data) {
        console.log('[DformComponent] Empty prefill => считаем новую анкету');
        this.cd.detectChanges();
        this.isReady = true;
        return;
      }

      // Если данные не пустые — идём по вашей логике
      // --------------------------------------------------
      if (this.form instanceof FormGroup) {
        //console.log('[DformComponent] Single form - patching data...');

        // -- Добавляем контрол "state", если его нет --
        if (!this.form.contains('state')) {
          this.form.addControl('state', new FormControl(''));
        }

        // Патчим данные
        this.form.patchValue(response.data);

        // Ждём, пока Angular применит значения в контролах
        setTimeout(() => {
          const country = this.form.get('country')?.value;
          const stVal = this.form.get('state')?.value;
          //console.log('[DformComponent] After patchValue — country:', country, 'state:', stVal);

          this.cd.detectChanges(); // ⏳ дожимаем рендер

          // Запускаем логику добавления и установки state
          setTimeout(() => {
            //console.log('[DformComponent] 🌍 Initializing country/state logic...');
            this.initializeCountryAndState(); // здесь добавится контрол state (если страна требует)

            // Проверим, что контрол действительно добавлен
            setTimeout(() => {
              const stateControl = this.form.get('state');
              //console.log('[DformComponent] ✅ Final state control:', stateControl);
              if (stateControl) {
                //console.log('[DformComponent] 🟢 Final state value:', stateControl.value);
              } else {
                //console.warn('[DformComponent] ⚠️ State control is STILL missing');
              }
              this.cd.detectChanges();
            }, 0);
          }, 0);
        }, 0);
      }

      else if (this.form instanceof FormArray) {
        //console.log('[DformComponent] FormArray - applying prefill items...');
        const arrayData = response.data.items;

        if (Array.isArray(arrayData) && arrayData.length > 0) {
          // Очищаем текущий FormArray
          while ((this.form as FormArray).length > 0) {
            (this.form as FormArray).removeAt(0);
          }
          // Для каждого элемента делаем singleFormGroup и пушим
          arrayData.forEach((item: any, i: number) => {
            const newFg = this.dinFormService.generateSingleFormGroup(this.processedData, {
              skipDefaults: false,
              initialValues: item
            });
            (this.form as FormArray).push(newFg);
            // Инициализация страны/штата
            this.initializeCountryAndState(i);
          });
          this.cd.detectChanges();
          this.isSingleFormView = false;
          this.isSurveySaved = true;
          //console.log('[DformComponent] FormArray: items loaded, manager view enabled.');
        } else {
          // Пусто => остаёмся в single form view
          //console.log('[DformComponent] FormArray: no items found, single form view remains.');
        }
      }
      // --------------------------------------------------

      this.cd.detectChanges();
      this.isReady = true;

    },
    error: (error: any) => {
      //console.error('[DformComponent] Prefill error:', error);
      clearTimeout(this.fallbackTimer);
      // this.toastr.error('Failed to load prefill data.');
      // Считаем, что данных нет => новая форма / или показываем что-то
      this.isReady = true;
      this.cd.detectChanges();
    }
  });
}


  // ----------------------------------------------------------------------------
  // Методы для FormArray / редактирования/удаления, без изменений
  // ----------------------------------------------------------------------------
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.dformCurrentPage = page;
      this.cd.detectChanges();
    }
  }



  override onYesNoChange(el: ElementData, value: string): void {
    // Если у нас FormArray и выбран элемент – используем selectedIndex
    const index = (this.form instanceof FormArray && this.selectedIndex !== null)
      ? this.selectedIndex
      : 0;
    super.onYesNoChange(el, value, index);
  }

  onAddNewItem(): void {
    if (!(this.form instanceof FormArray)) {
      console.warn('[DformComponent] onAddNewItem called but form is not a FormArray.');
      return;
    }
    //console.log('[DformComponent] onAddNewItem called. Current length:', this.form.length);

    if (this.form.length < this.maxItems) {
      if (!this.isSurveySaved) {
        this.toastr.warning('Please save the current survey before adding a new one.');
        return;
      }
      // Создаем новый FormGroup из JSON-схемы
      const newGroup = this.dinFormService.generateSingleFormGroup(this.processedData, {
        skipDefaults: false,
        initialValues: {}
      });
      (this.form as FormArray).push(newGroup);

      this.selectedIndex = this.form.length - 1;
      this.isSurveySaved = false;
      this.toastr.success('New survey added successfully.');
      this.cd.detectChanges();
    } else {
      this.toastr.warning('Maximum number of surveys reached.');
    }
  }

  onEditItem(index: number): void {
    console.log('[DformComponent] onEditItem called with index:', index);
    this.selectedIndex = index;
    this.isEditing = true;

    if (!(this.form instanceof FormArray)) {
      console.warn('[DformComponent] onEditItem called but form is not a FormArray.');
      return;
    }
    const formArray = this.form as FormArray;
    const currentGroup = formArray.at(index) as FormGroup;

    // Генерируем новую группу с учётом возможных полей
    const regenerated = this.dinFormService.generateSingleFormGroup(this.processedData, {
      skipDefaults: false,
      initialValues: currentGroup.value
    });

    // Заменяем текущий элемент
    formArray.setControl(index, regenerated);

    // Сохраняем бэкап на случай Cancel
    this.editFormBackup = JSON.parse(JSON.stringify(currentGroup.value));
    this.editForm = regenerated;
    this.originalFormRef = this.form;
    this.form = this.editForm; 
    this.initializeCountryAndState(); 
    console.log('[DEBUG] After initCountryState – editForm value:', this.editForm.value);
    console.log('[DEBUG] Controls present:', Object.keys(this.editForm.controls));
    // Подписка на изменения
    this.editFormSubscription?.unsubscribe();
    this.editFormSubscription = this.editForm.valueChanges.subscribe((newVal: any) => {
      console.warn('[DformComponent] Edit form changes - Index:', index, ', New value:', newVal);
    });

    this.cd.detectChanges();
  }

  onDeleteItem(index: number): void {
  // …ваша текущая проверка индексов…
  const formArray = this.form as FormArray;
  formArray.removeAt(index);

  // сразу сбрасываем selectedIndex и выходим из режима редактирования
  this.exitEditing();

  // собираем payload
  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    items: formArray.value
  };

  // отправляем на сервер
  this.formDataService.createFormData(this.componentName, payload).subscribe({
    next: () => {
      this.toastr.success('Survey deleted successfully.');
      this.isSurveySaved = true;
      this.cd.detectChanges();
    },
    error: err => {
      console.error('[DformComponent] delete persistence error', err);
      this.toastr.error('Failed to persist deletion.');
    }
  });
}


  onEditSubmit(): void {
    //console.log('[DformComponent] onEditSubmit(), selectedIndex:', this.selectedIndex);
    if (this.selectedIndex === null || this.editForm.invalid) {
      this.toastr.error('Form is invalid or no survey selected.');
      return;
    }

    const formArray = this.form as FormArray;
    const targetGroup = formArray.at(this.selectedIndex) as FormGroup;

    targetGroup.patchValue(this.editForm.value);
    this.editForm.markAsPristine();
    this.editFormBackup = null;
    this.exitEditing();
    this.cd.detectChanges();

    const payload = {
      ssn: this.ssn,
      bday: this.bday,
      param: this.param,
      items: formArray.value // вся коллекция
    };
    this.formDataService.createFormData(this.componentName, payload).subscribe({
      next: () => {
        this.toastr.success('Survey updated successfully.');
        this.isSurveySaved = true;
      },
      error: (error: any) => {
        console.error('[DformComponent] onEditSubmit error:', error);
        this.toastr.error('Failed to update survey.');
      }
    });
  }

  override onCancel(): void {
    if (!this.isSurveySaved && this.editForm.dirty && this.editFormBackup) {
      const confirmCancel = confirm('Discard changes?');
      if (confirmCancel) {
        this.editForm.patchValue(this.editFormBackup);
      }
    }
    this.exitEditing();
  }

  private exitEditing(): void {
    this.isEditing = false;
    this.selectedIndex = null;

    this.editFormSubscription?.unsubscribe();
     /* --- вернули всё на место --- */
    if (this.originalFormRef) {
      this.form = this.originalFormRef;
      this.originalFormRef = null;
    }
    /* ---------------------------- */



    this.cd.detectChanges();
  }

  override onSubmitFormArray(): void {
  if (!(this.form instanceof FormArray)) {
    console.error('[DformComponent] Form is not a FormArray.');
    return;
  }

  const formArray = this.form as FormArray;

  formArray.controls.forEach(ctrl => ctrl.updateValueAndValidity());

  if (formArray.invalid || formArray.length === 0) {
    this.markFormGroupTouched(formArray);
    this.toastr.error('Please complete all surveys before submitting.');
    return;
  }

  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    items: formArray.value
  };

  this.formDataService.createFormData(this.componentName, payload).subscribe({
    next: () => {
      this.toastr.success('All surveys submitted successfully.');
      this.isSurveySaved = true;
    },
    error: (error: any) => {
      console.error('[DformComponent] onSubmitFormArray error:', error);
      this.toastr.error('Failed to submit surveys.');
    }
  });
}


  override onSubmitSingleForm(): void {
  const group = this.getFormGroup() as FormGroup;

  if (!group) {
    console.error('[DformComponent] No FormGroup found.');
    return;
  }

  group.updateValueAndValidity();

  if (group.invalid) {
    this.markFormGroupTouched(group);
    this.toastr.error('Please fill all required fields.');
    return;
  }

  let payloadCore = this.preparePayload(group.value);
  payloadCore = this.removeOrphanControlsFromPayload(group, payloadCore);

  if (!payloadCore || Object.keys(payloadCore).length === 0) {
    this.toastr.error('Form is empty. Please fill it.');
    return;
  }

  if (!('state' in payloadCore)) {
    payloadCore.state = '';
  }

  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    ...payloadCore
  };

  this.formDataService.createFormData(this.componentName, payload).subscribe({
    next: () => {
      this.toastr.success('Form submitted successfully.');
      this.isSurveySaved = true;
    },
    error: err => {
      console.error('[DformComponent] onSubmitSingleForm error:', err);
      this.toastr.error('Failed to submit form.');
    }
  });
}



  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.values(formGroup.controls).forEach((control: AbstractControl) => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  ngOnDestroy(): void {
    this.editFormSubscription?.unsubscribe();
  }

  public getFormForIndex(i: number): FormGroup {
    if (this.form instanceof FormArray) {
      return this.form.at(i) as FormGroup;
    }
    return this.mainFormGroup;
  }

  public getActiveFormGroup(): FormGroup {
    if (this.form instanceof FormArray) {
      const idx = this.selectedIndex !== null ? this.selectedIndex : 0;
      return this.form.at(idx) as FormGroup;
    }
    return this.mainFormGroup;
  }
}
