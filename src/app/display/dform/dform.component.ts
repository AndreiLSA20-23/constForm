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
import { RequirementsService, IStartData } from '../../services/requirements.service';
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
  @Input() debugMode: boolean = true;

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
  storage!: IStartData;
  ready = false;
  loading = true;  
  error: string | null = null;

  constructor(
    @Inject(DinFormJsonWorkerService) dinFormService: DinFormJsonWorkerService,
    cd: ChangeDetectorRef,
    private formDataService: FormDataService,
    private http: HttpClient,
    private fb: FormBuilder,   
    private toastr: ToastrService,
    private reqSvc: RequirementsService,
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
    this.reqSvc.getStartData().subscribe({
      next: (data) => {
        this.storage = data;
        this.ready = true;
        this.loading = false; 
      },
      error: (error) => {
        this.error = 'Error loading data';
        this.loading = false; 
        console.error('[ReqComponent] Loads ERRORS');
      }
    });

    if (!this.componentName) {
      console.error('[DformComponent] Component name is not provided.');
      return;
    }

    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    this.loadRequirements();
    this.requirementsReady$.subscribe(() => {
    this.loadPrefillData();
    if (this.pageKeys?.length > 0) {
      this.totalPages = this.pageKeys.length;
      this.dformCurrentPage = 1;
    }

  });
  }

  private initializeYesNoFromPrefill(formGroup: FormGroup): void {
    const controls = formGroup.controls;
  
    Object.keys(controls).forEach(key => {
      const ctrl = controls[key];
  
      if (
        ctrl instanceof FormGroup &&
        ctrl.contains('value') &&
        typeof ctrl.get('value')?.value === 'string'
      ) {
        const val = ctrl.get('value')?.value;
        if (val === 'yes') {
          // всё уже добавлено сервисом — просто оставляем как есть
        } else if (val === 'no') {
          // Можно здесь очистить вложенные поля, если требуется
          // Object.keys(ctrl.controls).forEach(subKey => {
          //   if (subKey !== 'value') ctrl.removeControl(subKey);
          // });
        }
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
          this.cd.detectChanges();
          this.isReady = true;
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
                const stateControl = this.form.get('state');
                this.cd.detectChanges();
              }, 0);
            }, 0);
          }, 0);
        }
  
        else if (this.form instanceof FormArray) {
          const arrayData = response.data.items;
          console.log('[DformComponent] 🧩 Received FormArray data:', JSON.stringify(arrayData, null, 2));
  
          if (Array.isArray(arrayData) && arrayData.length > 0) {
            while ((this.form as FormArray).length > 0) {
              (this.form as FormArray).removeAt(0);
            }
  
            arrayData.forEach((item: any, i: number) => {
              const newFg = this.dinFormService.generateSingleFormGroup(this.processedData, {
                skipDefaults: false,
                initialValues: item
              });
            
              const countryVal = item?.country;
              const stateVal = item?.state ?? '';
              const hasStates = countryVal && this.countryDropdownData.stateOptions.hasOwnProperty(countryVal);
              if (hasStates && stateVal && !newFg.contains('state')) {
                newFg.addControl('state', new FormControl(stateVal));
              } else if (!hasStates && !newFg.contains('state')) {
                newFg.addControl('state', new FormControl(''));
              }
            
              // Устанавливаем значение
              if (newFg.get('state')) {
                newFg.get('state')!.setValue(stateVal);
              }
            
              //  Лог после установки state
              console.log(`[FA Prefill] #${i}: country=${countryVal}, state=${stateVal}, hasStates=${!!hasStates}`);
              console.log(`[FA Prefill] #${i}: form.contains('state')=${newFg.contains('state')}, value="${newFg.get('state')?.value}"`);
            
              (this.form as FormArray).push(newFg);
            
              this.initializeCountryAndState(newFg);
              this.initializeYesNoFromPrefill(newFg);
            });
            
            
  
            this.cd.detectChanges();
            this.isSingleFormView = false;
            this.isSurveySaved = true;
          }
        }
  
        this.cd.detectChanges();
        this.isReady = true;
      },
      error: (error: any) => {
        clearTimeout(this.fallbackTimer);
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
    if (!(this.form instanceof FormArray)) return;
  
    if (this.form.length >= this.maxItems) {
      this.toastr.warning('Maximum number of surveys reached.');
      return;
    }
  
    if (!this.isSurveySaved) {
      this.toastr.warning('Please save the current survey before adding a new one.');
      return;
    }
  
    const newGroup = this.dinFormService.generateSingleFormGroup(this.processedData, {
      skipDefaults: false,
      initialValues: {}
    });
	
    /*
    newGroup.get('country')?.valueChanges.subscribe((newCountry) => {
     this.initializeCountryAndState(newGroup);
    });
    */

    newGroup.get('country')?.valueChanges.subscribe((newCountry: string | null) => {
      this.initializeCountryAndState(newGroup);
    });
  
    (this.form as FormArray).push(newGroup);
  
    this.selectedIndex = this.form.length - 1;
    this.isSurveySaved = false;
    this.toastr.success('New survey added successfully.');
    this.cd.detectChanges();
  }
  
  onEditItem(index: number): void {
    this.selectedIndex = index;
    this.isEditing = true;
  
    if (!(this.form instanceof FormArray)) {
      console.warn('[DformComponent] ❌ onEditItem called but form is not a FormArray.');
      return;
    }
  
    const formArray = this.form as FormArray;
    const currentGroup = formArray.at(index) as FormGroup;
    const initialValues = currentGroup.getRawValue();

  
    this.editFormBackup = JSON.parse(JSON.stringify(initialValues));
  
    this.editForm = this.dinFormService.generateSingleFormGroup(this.processedData, {
      skipDefaults: false,
      initialValues
    });
  
    const rawCountry = initialValues?.country?.trim?.() || '';
    const rawState = initialValues?.state?.trim?.() || '';
  
    if (rawCountry) {
      this.editForm.get('country')?.setValue(rawCountry);
  
      const hasStates = this.countryDropdownData.stateOptions.hasOwnProperty(rawCountry);
      if (hasStates && !this.editForm.contains('state')) {
        this.editForm.addControl('state', new FormControl(rawState));
      }
    } else {
      console.warn('[DformComponent] ⚠️ No country in initialValues, skipping state init.');
    }
  
    // Инициализация
    this.initializeCountryAndState(this.editForm);
  
    // 🧩 Принудительно устанавливаем state значение, если есть
    const hasStates = this.countryDropdownData.stateOptions.hasOwnProperty(rawCountry);
    if (hasStates && rawState && this.editForm.get('state')) {
      this.editForm.get('state')!.setValue(rawState);
    }
  
    // Подписка на изменения страны
    this.editForm.get('country')?.valueChanges.subscribe((newCountry) => {
      this.initializeCountryAndState(this.editForm);
    });
  
    const stateCtrl = this.editForm.get('state');
    this.editFormSubscription?.unsubscribe();
    this.editFormSubscription = this.editForm.valueChanges.subscribe((newVal: any) => {
    });

    Object.entries(this.editForm.controls).forEach(([key, ctrl]) => {
      if (ctrl instanceof FormGroup && ctrl.get('value')) {
        console.log(`[EditItem] YESNO "${key}":`, ctrl.value);
        const subKeys = Object.keys(ctrl.controls).filter(k => k !== 'value');
        console.log(` ↳ Sub-controls (${subKeys.length}) for "${key}":`, subKeys);
        subKeys.forEach(subKey => {
          console.log(`   • ${subKey}:`, ctrl.get(subKey)?.value);
        });
      }
    });

    this.initializeYesNoFromPrefill(this.editForm); 
  
    this.cd.detectChanges();
  }
  
  onDeleteItem(index: number): void {
  // …ваша текущая проверка индексов…
  const formArray = this.form as FormArray;
  formArray.removeAt(index);

  // сразу сбрасываем selectedIndex и выходим из режима редактирования
  this.exitEditing();
  const items = (formArray.controls as FormGroup[]).map(ctrl =>
    this.flattenYesnoGroups(ctrl.getRawValue(), this.processedData)
  );
  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    items
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
  if (this.selectedIndex === null || this.editForm.invalid || !(this.form instanceof FormArray)) {
    this.toastr.error('Form is invalid or no survey selected.');
    return;
  }

  const formArray = this.form as FormArray;

  const rawCountry = this.editForm.get('country')?.value?.trim?.();
  const hasStates = rawCountry && this.countryDropdownData.stateOptions.hasOwnProperty(rawCountry);

  if (hasStates && !this.editForm.contains('state')) {
    const rawState = '';
    this.editForm.addControl('state', new FormControl(rawState));
  }

  // *** СЮДА: flat ***
  const flatEditForm = this.flattenYesnoGroups(this.editForm.getRawValue(), this.processedData);
  console.log('[onEditSubmit][DEBUG] flatEditForm:', JSON.stringify(flatEditForm, null, 2));

  // Важно: глубокая копия!
  const safeFlat = typeof structuredClone === 'function'
    ? structuredClone(flatEditForm)
    : JSON.parse(JSON.stringify(flatEditForm));

  //....formArray.at(this.selectedIndex).setValue(safeFlat);
  formArray.at(this.selectedIndex).patchValue(flatEditForm)


  this.editForm.markAsPristine();
  this.editFormBackup = null;

  // ⚡ Твой общий payload
  const items = (formArray.controls as FormGroup[]).map((ctrl, i) => {
    const flat = this.flattenYesnoGroups(ctrl.getRawValue(), this.processedData);
    console.log(`[onEditSubmit][DEBUG] flat[${i}]:`, JSON.stringify(flat, null, 2));
    return flat;
  });

  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    items
  };

  console.log('[DformComponent][onEditSubmit] Final payload to be sent:', JSON.stringify(payload, null, 2));

  this.formDataService.createFormData(this.componentName, payload).subscribe({
    next: () => {
      this.toastr.success('Survey updated successfully.');
      this.isSurveySaved = true;
      this.exitEditing();
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
  
    this.editFormSubscription?.unsubscribe();
    this.editForm = this.fb.group({}); // Очищаем editForm
  
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
  
    // 🚩 flattenYesnoGroups для каждого item!
    const items = (formArray.controls as FormGroup[]).map((ctrl, i) => {
      const flat = this.flattenYesnoGroups(ctrl.getRawValue(), this.processedData);
      console.log(`[onSubmitFormArray][DEBUG] flat[${i}]:`, JSON.stringify(flat, null, 2));
      return flat;
    });
  
    const payload = {
      ssn: this.ssn,
      bday: this.bday,
      param: this.param,
      items
    };
  
    console.log('[DformComponent][onSubmitFormArray] Final payload to be sent:', JSON.stringify(payload, null, 2));
  
    this.formDataService.createFormData(this.componentName, payload).subscribe({
      next: () => {
        this.toastr.success('All surveys submitted successfully.');
        this.isSurveySaved = true;
        if (this.isSingleFormView && (this.form as FormArray).length === 1) {
          this.isSingleFormView = false;
          this.cd.detectChanges();
        }
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
  const flat = this.flattenYesnoGroups(group.getRawValue(), this.processedData);
  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    ...payloadCore,
    ...flat
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

  public flattenYesnoGroups(formValue: any, processedData: any): any {
    let result = { ...formValue };
    (processedData.elements || []).forEach((el: ElementData) => {
      if (el.type === 'yesno' && el.subElements?.length) {
        const yesnoName = el.formControlName || el.id;
        const yesnoGroup = formValue[yesnoName];
        if (yesnoGroup && typeof yesnoGroup === 'object') {
          result[yesnoName] = { value: yesnoGroup.value };
          el.subElements.forEach((sub: ElementData) => {
            const subName = sub.formControlName || sub.id;
            if (!subName) return;
            if (sub.type === 'yesno' && yesnoGroup.hasOwnProperty(subName)) {
              // Рекурсия по вложенному yesno
              result[yesnoName][subName] = this.flattenYesnoGroups(yesnoGroup[subName], sub);
            } else if (yesnoGroup.hasOwnProperty(subName)) {
              result[yesnoName][subName] = yesnoGroup[subName];
            }
          });
        }
      }
    });
    return result;
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
  get componentTitle(): string {
    return this.componentName
      ?.replace('app-', '')
      ?.replace(/-/g, ' ')
      ?.replace(/\b\w/g, l => l.toUpperCase()) || 'Survey Manager';
}

}
