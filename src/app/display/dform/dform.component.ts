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
  
    this.fallbackTimer = setTimeout(() => {
      console.warn('[DformComponent] Prefill request timed out — showing blank form.');
      this.isReady = true;
      this.cd.detectChanges();
    }, 10000);
  
    this.http.get(url).subscribe({
      next: (response: any) => {
        clearTimeout(this.fallbackTimer);
  
        if (!response || !response.data) {
          console.log('[DformComponent] Empty prefill => считаем новую анкету');
          this.isSingleFormView = true;
          this.selectedIndex = null;
          this.isReady = true;
          this.cd.detectChanges();
          return;
        }
  
        if (this.form instanceof FormGroup) {
          if (!this.form.contains('state')) {
            this.form.addControl('state', new FormControl(''));
          }
  
          this.form.patchValue(response.data);
  
          setTimeout(() => {
            this.cd.detectChanges();
            setTimeout(() => {
              this.initializeCountryAndState();
              setTimeout(() => {
                this.cd.detectChanges();
              }, 0);
            }, 0);
          }, 0);
  
          this.isSingleFormView = true;
          this.selectedIndex = null;
        }
  
        else if (this.form instanceof FormArray) {
          const arrayData = response.data.items;
  
          if (Array.isArray(arrayData) && arrayData.length > 0) {
            while (this.form.length > 0) {
              this.form.removeAt(0);
            }
  
            arrayData.forEach((item: any, i: number) => {
              const newFg = this.dinFormService.generateSingleFormGroup(this.processedData, {
                skipDefaults: false,
                initialValues: item
              });
              (this.form as FormArray).push(newFg);
              this.initializeCountryAndState(i);
            });
  
            this.isSingleFormView = false;
            this.isSurveySaved = true;
            this.selectedIndex = null;
          } else {
            this.isSingleFormView = true;
            this.selectedIndex = null;
          }
        }
  
        this.isReady = true;
        this.cd.detectChanges();
      },
  
      error: (error: any) => {
        clearTimeout(this.fallbackTimer);
        console.error('[DformComponent] Prefill error:', error);
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
  
    if (!this.isSurveySaved) {
      this.toastr.warning('Please save the current survey before adding a new one.');
      return;
    }
  
    if (this.form.length >= this.maxItems) {
      this.toastr.warning('Maximum number of surveys reached.');
      return;
    }
  
    // 1. Создаём новую пустую запись
    const newGroup = this.dinFormService.generateSingleFormGroup(this.processedData, {
      skipDefaults: false,
      initialValues: {}
    });
  
    // 2. Добавляем в основной FormArray
    (this.form as FormArray).push(newGroup);
    this.selectedIndex = this.form.length - 1;
  
    // 3. Копируем для editForm — для работы модалки
    const regenerated = this.dinFormService.generateSingleFormGroup(this.processedData, {
      skipDefaults: false,
      initialValues: newGroup.value
    });
  
    this.editForm = regenerated;
    this.editFormBackup = JSON.parse(JSON.stringify(newGroup.value));
    this.isEditing = true;
    this.isSurveySaved = false;
  
    // 4. Инициализация страны/штата
    this.initializeCountryAndState(this.selectedIndex);
  
    // 5. Лог и подписка
    console.log('[onAddNewItem] Модалка: selectedIndex =', this.selectedIndex);
    this.editFormSubscription?.unsubscribe();
    this.editFormSubscription = this.editForm.valueChanges.subscribe((val) => {
      console.log('[editForm] changes:', val);
    });
  
    this.cd.detectChanges();
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
  
    // Подготовка данных для модалки
    this.editForm = regenerated;
    this.editFormBackup = JSON.parse(JSON.stringify(currentGroup.value));
    this.originalFormRef = this.form; // сохраняем основную форму, если понадобится восстановить
  
    // Инициализация страны/штата
    this.initializeCountryAndState(index);
  
    // Логирование
    console.log('[onEditItem] editForm value:', this.editForm.value);
    console.log('[onEditItem] editForm controls:', Object.keys(this.editForm.controls));
  
    // Подписка на изменения формы
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
  if (this.selectedIndex === null || this.editForm.invalid) {
    this.toastr.error('Form is invalid or no survey selected.');
    return;
  }

  const formArray = this.originalFormRef as FormArray;
  if (!formArray || !(formArray instanceof FormArray)) {
    this.toastr.error('Cannot access original form array.');
    return;
  }

  const targetGroup = formArray.at(this.selectedIndex) as FormGroup;
  if (!targetGroup) {
    this.toastr.error('Target form group not found.');
    return;
  }

  targetGroup.patchValue(this.editForm.value);
  this.editForm.markAsPristine();
  this.editFormBackup = null;
  this.exitEditing(); // не трогаем this.form внутри

  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    items: formArray.value
  };

  this.formDataService.createFormData(this.componentName, payload).subscribe({
    next: () => {
      this.toastr.success('Survey updated successfully.');
      this.isSurveySaved = true;
      this.cd.detectChanges();
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
  
    // Отписываемся от изменений editForm
    this.editFormSubscription?.unsubscribe();
    this.editFormSubscription = null;
  
    // Возвращаем ссылку на основную форму, если была временно заменена (например, при редактировании)
    if (this.originalFormRef) {
      this.form = this.originalFormRef;
      this.originalFormRef = null;
    }
  
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
