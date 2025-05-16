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

          (this.processedData.elements || []).forEach((el) => {
            if (el.type === 'yesno' && el.subElements) {
              const name = el.formControlName || el.id;
              const val = this.form.get(name)?.value;
              if (val !== 'yes') {
                el.subElements.forEach((sub) => {
                  const subName = sub.formControlName || sub.formGroup;
                  if (
                    typeof subName === 'string' &&
                    this.form instanceof FormGroup &&
                    this.form.get(subName)
                  ) {
                    this.form.removeControl(subName);
                  }
                  
                });
              }
            }
          });
            
  
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
  
          if (Array.isArray(arrayData) && arrayData.length > 0) {
            while ((this.form as FormArray).length > 0) {
              (this.form as FormArray).removeAt(0);
            }
  
            arrayData.forEach((item: any, i: number) => {
              const newFg = this.dinFormService.generateSingleFormGroup(this.processedData, {
                skipDefaults: false
              });
              newFg.patchValue(item);  
              (this.form as FormArray).push(newFg);
              
              this.cd.detectChanges(); 
              
              this.initializeCountryAndState(newFg); 
              
              const rawCountry = item?.country?.trim?.() || '';
              const rawState = item?.state?.trim?.() || '';
              
              if (rawCountry && rawState && this.countryDropdownData.stateOptions?.[rawCountry]) {
                if (!newFg.get('state')) {
                  newFg.addControl('state', new FormControl(rawState));
                } else {
                  newFg.get('state')?.setValue(rawState);
                }
              }
      
              (this.processedData.elements || []).forEach((el) => {
                if (el.type === 'yesno' && el.subElements) {
                  const name = el.formControlName || el.id;
                  const val = newFg.get(name)?.value;
              
                  console.log(`[Dform] FA[${i}] → ${name} = ${val}`);
              
                  if (val !== 'yes') {
                    el.subElements.forEach((sub) => {
                      const subName = sub.formControlName || sub.formGroup;
                      if (typeof subName === 'string' && newFg.get(subName)) {
                        newFg.removeControl(subName);
                        console.warn(`[Dform] FA[${i}] removed ${subName} after ${name}=no`);
                      }
                    });
                  }
                }
              });
              
              (this.form as FormArray).push(newFg);
              this.initializeCountryAndState(newFg);
              if (
                rawCountry &&
                rawState &&
                this.countryDropdownData.stateOptions.hasOwnProperty(rawCountry)
              ) {
                if (!newFg.get('state')) {
                  newFg.addControl('state', new FormControl(rawState));
                } else {
                  newFg.get('state')!.setValue(rawState);
                }
              }
            
              (this.processedData.elements || []).forEach((el) => {
                if (el.type === 'yesno' && el.subElements) {
                  const name = el.formControlName || el.id;
                  const val = newFg.get(name)?.value;
                  if (val !== 'yes') {
                    el.subElements.forEach((sub) => {
                      const subName = sub.formControlName || sub.formGroup;
                      if (
                        typeof subName === 'string' &&
                        newFg instanceof FormGroup &&
                        newFg.get(subName)
                      ) {
                        newFg.removeControl(subName);
                        console.warn(`[Dform] FA: removed ${subName} after value=no`);
                      }
                    });
                  }
                }
              });
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
  
    ///Тут убеанская правка
    newGroup.get('country')?.valueChanges.subscribe((newCountry: string | null) => {
      this.initializeCountryAndState(newGroup);
    });
    //



  
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
      console.warn('[DformComponent]  onEditItem called but form is not a FormArray.');
      return;
    }
  
    const formArray = this.form as FormArray;
    const currentGroup = formArray.at(index) as FormGroup;
    const initialValues = currentGroup.value;
  
    this.editFormBackup = JSON.parse(JSON.stringify(initialValues));
  
    this.editForm = this.dinFormService.generateSingleFormGroup(this.processedData, {
      skipDefaults: false,
      initialValues
    });
  
    const rawCountry = initialValues?.country?.trim?.() || '';
    const rawState = initialValues?.state?.trim?.() || '';
  
    //console.log('[DformComponent] EditItem → rawCountry:', rawCountry);
    //console.log('[DformComponent] EditItem → rawState:', rawState);
  
    if (rawCountry) {
      this.editForm.get('country')?.setValue(rawCountry);
  
      const hasStates = this.countryDropdownData.stateOptions.hasOwnProperty(rawCountry);
      if (hasStates) {
        const stateExists = this.editForm.contains('state');
  
        //console.log('[DformComponent] EditItem → hasStates:', hasStates);
        //console.log('[DformComponent] EditItem → editForm.contains("state"):', stateExists);
  
        if (!stateExists) {
          this.editForm.addControl('state', new FormControl(rawState));
          //console.log('[DformComponent] EditItem → state control added manually with value:', rawState);
        } else {
          this.editForm.get('state')?.setValue(rawState);
          //console.log('[DformComponent] EditItem → state control updated with value:', rawState);
        }
      }
    } else {
      console.warn('[DformComponent]  No country in initialValues, skipping state init.');
    }
  
    // Инициализация логики country/state
    this.initializeCountryAndState(this.editForm);
  
    // Подписка на изменение страны
    this.editForm.get('country')?.valueChanges.subscribe((newCountry) => {
      console.log('[DformComponent] Country changed to:', newCountry);
      this.initializeCountryAndState(this.editForm);
    });
  
    const stateCtrl = this.editForm.get('state');
    console.log('[DformComponent] Final state control:', {
      exists: !!stateCtrl,
      value: stateCtrl?.value,
      status: stateCtrl?.status
    });
  
    this.editFormSubscription?.unsubscribe();
    this.editFormSubscription = this.editForm.valueChanges.subscribe(() => {
      // Future extension
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
  if (this.selectedIndex === null || this.editForm.invalid || !(this.form instanceof FormArray)) {
    this.toastr.error('Form is invalid or no survey selected.');
    return;
  }

  const formArray = this.form as FormArray;

  const rawCountry = this.editForm.get('country')?.value?.trim?.();
  const hasStates = rawCountry && this.countryDropdownData.stateOptions.hasOwnProperty(rawCountry);

  // Если страна требует штаты, а state отсутствует — добавим его вручную
  if (hasStates && !this.editForm.contains('state')) {
    const rawState = '';
    this.editForm.addControl('state', new FormControl(rawState));
  }

  //  Обновляем FormArray значением из editForm
  formArray.at(this.selectedIndex).patchValue(this.editForm.value);

  this.editForm.markAsPristine();
  this.editFormBackup = null;

  const payload = {
    ssn: this.ssn,
    bday: this.bday,
    param: this.param,
    items: formArray.value};


  //console.log('[DformComponent]  Final payload to be sent:', JSON.stringify(payload, null, 2));

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
  get componentTitle(): string {
    return this.componentName
      ?.replace('app-', '')
      ?.replace(/-/g, ' ')
      ?.replace(/\b\w/g, l => l.toUpperCase()) || 'Survey Manager';
  }
}
