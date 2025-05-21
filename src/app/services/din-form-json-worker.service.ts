import { Injectable } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidatorFn,
  FormArray
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ElementType =
  | 'textbox'
  | 'password'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'multiselect'
  | 'date'
  | 'time'
  | 'datetime'
  | 'month'
  | 'week'
  | 'color'
  | 'range'
  | 'file'
  | 'dayMonthYear'
  | 'monthYear'
  | 'yesno'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'button'
  | 'form'
  | 'row'
  | 'column'
  | 'signaturePad'
  | 'toggle'
  | 'tagInput'
  | 'countryDropdown';

export interface RowData {
  type: 'row';
  cssClasses: string[];
  columns: ColumnData[];
}

export interface ColumnData {
  type: 'column';
  cssClasses: string[];
  elements: ElementData[];
}

export interface ElementData {
  id: string;
  type: ElementType;
  cssClasses: string[];
  label?: string;
  content?: string;
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  validation?: string;
  validationMessage?: string;
  options?: string[];
  items?: string[];
  rows?: RowData[];
  elements?: ElementData[];
  subElements?: ElementData[];
  action?: {
    type: 'submit' | 'button' | 'reset' | 'edit';
    callback?: string;
  };
  formControlName?: string;
  formGroup?: string;
  description?: string;
  [key: string]: any;
}

export interface FormComponentData {
  id: string;
  type: 'form';
  formGroup?: string;
  submitAction?: string;
  elements: RowData[] | ElementData[];
  multiple?: boolean;
  [key: string]: any;
}

export interface RequirementsData {
  variables?: Record<string, any>;
  components?: Record<string, any>;
}

export interface CountryDropdown extends ElementData {
  type: 'countryDropdown';
  countries: string[];
  stateOptions: { [country: string]: string[] };
  stateLabel?: string;
}

const INPUT_TYPES: ElementType[] = [
  'textbox', 'password', 'textarea',
  'checkbox', 'radio', 'toggle',
  'dropdown', 'multiselect',
  'date', 'time', 'datetime', 'month', 'week',
  'color', 'range', 'file',
  'dayMonthYear', 'monthYear',
  'yesno', 'signaturePad', 'tagInput',
  'countryDropdown'
];
const validators: ValidatorFn[] = [];



@Injectable({
  providedIn: 'root',
})
export class DinFormJsonWorkerService {
  private requirementsData: RequirementsData = {};
  private elementsCache = new Map<string, ElementData[]>();
  private readonly REQUIRED_CONTROLS = ['startDate', 'endDate', 'state', 'country'];
  private debugMode=false;
  
  //Запрос пути
  private requirementsPath = '/requirements_default.json'; // по умолчанию

  setRequirementsPath(path: string) {
    this.requirementsPath = path;
  }

  getRequirementsPath(): string {
    return this.requirementsPath;
  }
  //Конец
  
  private countryDropdownData: CountryDropdown = {
    id: 'countryDropdown1',
    type: 'countryDropdown',
    cssClasses: ['form-select', 'form-select-sm'],
    label: 'Country',
    formControlName: 'country',
    countries: [
      "United States", "Canada", "United Kingdom", "Germany", "France", "Italy",
      "Spain", "Australia", "Japan", "China", "India", "Brazil", "Mexico", "Russia",
      "South Korea", "Netherlands", "Sweden", "Norway", "Denmark", "Finland",
      "Switzerland", "Belgium", "Austria", "Ireland", "Portugal", "Greece",
      "Poland", "Czech Republic", "Hungary", "Turkey", "Saudi Arabia",
      "United Arab Emirates", "Israel", "Egypt", "South Africa", "Nigeria",
      "Argentina", "Chile", "Colombia", "Peru", "Venezuela", "New Zealand",
      "Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam", "Philippines",
      "Pakistan", "Bangladesh"
    ],
    stateOptions: {
      "United States": [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
        "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
        "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
        "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
        "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
        "New Hampshire", "New Jersey", "New Mexico", "New York",
        "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
        "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
        "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
        "West Virginia", "Wisconsin", "Wyoming"
      ],
      "Canada": [
        "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba",
        "Saskatchewan", "Nova Scotia", "New Brunswick",
        "Newfoundland and Labrador", "Prince Edward Island"
      ],
      "Australia": [
        "New South Wales", "Victoria", "Queensland", "Western Australia",
        "South Australia", "Tasmania", "Northern Territory",
        "Australian Capital Territory"
      ],
      "India": [
        "Uttar Pradesh", "Maharashtra", "Bihar", "West Bengal", "Tamil Nadu",
        "Rajasthan", "Karnataka", "Gujarat", "Andhra Pradesh", "Odisha"
      ],
      "Mexico": [
        "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
        "Chiapas", "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato",
        "Guerrero", "Hidalgo", "Jalisco", "México", "Michoacán", "Morelos",
        "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo",
        "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
        "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
      ],
      "Brazil": [
        "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará",
        "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso",
        "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná",
        "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte",
        "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina",
        "São Paulo", "Sergipe", "Tocantins", "Distrito Federal"
      ],
      "United Kingdom":[],
      "Germany":[],
      "France":[],
      "Italy":[],
      "Spain":[], 
      "Japan":[], 
      "China":[], 
      "Russia":[],
      "South Korea":[],
      "Netherlands":[],
      "Sweden":[],
      "Norway":[], 
      "Denmark":[], 
      "Finland":[],
      "Switzerland":[],
      "Belgium":[],
      "Ireland":[], 
      "Austria":[],
      "Portugal":[], 
      "Greece":[],
      "Czech Republic":[],
      "Poland":[], 
      "Hungary":[], 
      "Turkey":[], 
      "Saudi Arabia":[],
      "Israel":[],
      "United Arab Emirates":[],
      "Egypt":[],
      "Nigeria":[],
      "South Africa":[], 
      "Chile":[],
      "Argentina":[], 
      "Colombia":[],
      "Peru":[], 
      "Venezuela":[], 
      "New Zealand":[],
      "Singapore":[],
      "Malaysia":[],
      "Thailand":[],
      "Indonesia":[],
      "Vietnam":[],
      "Pakistan":[], 
      "Philippines":[],
      "Bangladesh":[]


    },
    stateLabel: "State/Province"
  };

  constructor(
    private http: HttpClient,
    private fb: FormBuilder
  ) {}




  loadRequirements(jsonPath: string): Observable<RequirementsData> {
    return new Observable((observer) => {
      this.http.get<RequirementsData>(jsonPath).subscribe({
        next: (data) => {
          this.requirementsData = data;
          observer.next(data);
          observer.complete();
        },
        error: (err) => {
          observer.error(err);
        },
      });
    });
  }

  getFullRequirements(): RequirementsData {
    return this.requirementsData;
  }

  getComponentData(componentName: string): any {
    return this.requirementsData.components?.[componentName] ?? null;
  }

  private getControlName(el: ElementData): string {
    if (el.type === 'countryDropdown') return el.formControlName || 'country';
    return el.formControlName || el.id;
  }

  private getUniqueControlName(baseName: string, controls: Record<string, AbstractControl>): string {
    let name = baseName;
    let counter = 1;
    while (controls.hasOwnProperty(name)) {
      name = `${baseName}_${counter}`;
      counter++;
    }
    return name;
  }

  private parseElementsRecursively(
    struct: any,
    result: ElementData[] = [],
    useCache: boolean = false
  ): ElementData[] {
    const cacheKey = useCache ? JSON.stringify(struct) : null;
    if (cacheKey && this.elementsCache.has(cacheKey)) {
      return [...this.elementsCache.get(cacheKey)!];
    }
    if (Array.isArray(struct)) {
      struct.forEach(item => this.parseElementsRecursively(item, result, useCache));
    } else if (struct && typeof struct === 'object') {
      this.processObjectStructure(struct, result, useCache);
    }
    if (cacheKey) {
      this.elementsCache.set(cacheKey, [...result]);
    }
    return result;
  }

  private processObjectStructure(struct: any, result: ElementData[], useCache: boolean) {
    if (struct.pages) {
      Object.values(struct.pages).forEach(page =>
        this.parseElementsRecursively(page, result, useCache)
      );
    }
    if (struct.type === 'row' && struct.columns) {
      struct.columns.forEach((col: any) =>
        this.parseElementsRecursively(col, result, useCache)
      );
    }
    if (struct.type === 'column' && struct.elements) {
      this.parseElementsRecursively(struct.elements, result, useCache);
    }
    if (struct.elements) {
      this.parseElementsRecursively(struct.elements, result, useCache);
    }
    if (struct.rows) {
      this.parseElementsRecursively(struct.rows, result, useCache);
    }
    if (struct.type !== 'yesno' && struct.subElements) {
      this.parseElementsRecursively(struct.subElements, result, useCache);
    }
    if (INPUT_TYPES.includes(struct.type)) {
      result.push(struct);
    }
  }

  // Рекурсивная функция для поиска значения по ключу в вложенной структуре
  private findNestedValue(obj: any, key: string): any {
    if (obj !== null && typeof obj === 'object') {
      if (obj.hasOwnProperty(key)) {
        return obj[key];
      }
      for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          const result = this.findNestedValue(obj[prop], key);
          if (result !== undefined) {
            return result;
          }
        }
      }
    }
    return undefined;
  }


  cleanNulls(value: any): any {
    if (Array.isArray(value)) {
      return value.map(v => this.cleanNulls(v));
    }
    if (value !== null && typeof value === 'object') {
      const cleaned: any = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          const val = value[key];
          if (typeof val === 'boolean') {
            cleaned[key] = val; // оставляем как есть
          } else if (val === null || val === undefined) {
            cleaned[key] = ''; // заменяем null/undefined на ''
          } else {
            cleaned[key] = this.cleanNulls(val); // рекурсивно
          }
        }
      }
      return cleaned;
    }
    return value === null || value === undefined ? '' : value;
  }

  generateSingleFormGroup(
    struct: any,
    options: { 
      skipDefaults?: boolean; 
      initialValues?: any; 
      keepNulls?: boolean;
      countryData?: any;
    } = {}
  ): FormGroup {
    // Validate input structure
    if (!struct || typeof struct !== 'object') {
      throw new Error('Invalid structure: must be an object');
    }
  
    // Destructure with defaults and validate options
    const {
      skipDefaults = false,
      initialValues = {},
      keepNulls = false,
      countryData
    } = options;
  
    if (typeof skipDefaults !== 'boolean' || typeof keepNulls !== 'boolean') {
      throw new Error('Invalid options: skipDefaults and keepNulls must be boolean');
    }
  
    // Create deep clones of input data
    const cleanedValues = this.cleanNulls(initialValues);
    const clonedValues = structuredClone(cleanedValues);
    const usedCountryDropdownData = countryData ? 
      structuredClone(countryData) : 
      this.getCountryDropdownData();
  
    // Validate country data structure
    if (!usedCountryDropdownData || 
        !usedCountryDropdownData.countries || 
        !usedCountryDropdownData.stateOptions) {
      console.warn('Invalid country dropdown data structure');
    }
  
    // Flatten structure if it contains pages
    let structForForm = struct;
    if (struct["pages"]) {
      let flatElements: any[] = [];
      Object.keys(struct["pages"]).forEach(key => {
        const page = struct["pages"][key];
        if (page.elements && Array.isArray(page.elements)) {
          flatElements = flatElements.concat(page.elements);
        } else if (page.rows && Array.isArray(page.rows)) {
          flatElements = flatElements.concat(page.rows);
        }
      });
      structForForm = { ...struct, elements: flatElements };
    }
  
    // Parse form elements
    const formElements = this.parseElementsRecursively(structForForm, [], false);
    if (!formElements.length) {
      console.warn('No form elements found in structure');
    }
  
    const controls: Record<string, AbstractControl> = {};
  
    formElements.forEach(el => {
      if (!el.type) {
        console.warn('Element missing type property', el);
        return;
      }
  
      const baseName = this.getControlName(el);
      const ctrlName = el.formControlName ? baseName : this.getUniqueControlName(baseName, controls);
  
      // Process initial value
      let startValue = clonedValues[ctrlName];
      if ((startValue === undefined || startValue === '') && !skipDefaults) {
        startValue = el.defaultValue;
      }
      if (startValue === null && !keepNulls) {
        startValue = '';
      }
  
      const validators = this.buildValidators(el);
  
      switch (el.type) {
        case 'dayMonthYear':
          controls[ctrlName] = this.fb.group({
            day: new FormControl(startValue?.day ?? '', validators),
            month: new FormControl(startValue?.month ?? '', validators),
            year: new FormControl(startValue?.year ?? '', validators),
          });
          break;
  
        case 'monthYear':
          controls[ctrlName] = this.fb.group({
            month: new FormControl(startValue?.month ?? '', validators),
            year: new FormControl(startValue?.year ?? '', validators),
          });
          break;
  
        case 'multiselect':
          controls[ctrlName] = new FormControl(
            Array.isArray(startValue) ? [...startValue] : [], 
            validators
          );
          break;
  
        case 'countryDropdown': {
          const controlName = this.getControlName(el);
          const stateName = el["stateControlName"] ?? 'state_' + controlName;
          
          // Get country and state values with fallbacks
          const countryValue = clonedValues[controlName] ?? 
                            this.findNestedValue(clonedValues, controlName) ?? '';
          const stateValue = clonedValues[stateName] ?? 
                           this.findNestedValue(clonedValues, stateName) ?? '';
  
          // Validate country value exists in dropdown data
          if (countryValue && !usedCountryDropdownData.countries.includes(countryValue)) {
            console.warn(`Country "${countryValue}" not found in dropdown options`);
          }
  
          controls[controlName] = new FormControl(countryValue ?? '', validators);
  
          // Handle state control conditionally
          if (usedCountryDropdownData?.stateOptions?.[countryValue]) {
            const stateList = usedCountryDropdownData.stateOptions[countryValue];
            if (Array.isArray(stateList) && stateList.length > 0) {
              // Validate state value exists in options
              if (stateValue && !stateList.includes(stateValue)) {
                console.warn(`State "${stateValue}" not found in options for country "${countryValue}"`);
              }
              controls[stateName] = new FormControl(stateValue ?? '', validators);
            }
          }
          break;
        }
  
        case 'yesno': {
          const yesNoGroup = this.fb.group({});
          let normalizedValue = startValue;
  
          // Normalize yesno value
          if (typeof normalizedValue === 'object' && normalizedValue !== null && 'value' in normalizedValue) {
            normalizedValue = normalizedValue.value;
          }
          if (typeof normalizedValue === 'boolean') {
            normalizedValue = normalizedValue ? 'yes' : 'no';
          } else if (typeof normalizedValue === 'string') {
            normalizedValue = normalizedValue.trim().toLowerCase();
          }
          if (!normalizedValue) {
            normalizedValue = 'no';
          }
  
          const valueValidators = el.required ? [Validators.required] : [];
          yesNoGroup.addControl('value', new FormControl(normalizedValue, valueValidators));
  
          // Process sub-elements
          if (el.subElements) {
            el.subElements.forEach(subEl => {
              const subName = subEl.formControlName || subEl.id;
              if (!subName) {
                console.warn('Sub-element missing name', subEl);
                return;
              }
              
              const subValue = (typeof startValue === 'object' && startValue?.[subName] !== undefined)
                ? startValue[subName]
                : (subEl.defaultValue ?? '');
                
              const subValidators = this.buildValidators(subEl);
              yesNoGroup.addControl(subName, new FormControl(subValue, subValidators));
            });
          }
  
          controls[ctrlName] = yesNoGroup;
          break;
        }
  
        default:
          if (el.type === 'checkbox') {
            startValue = (startValue === null || startValue === undefined) ? false : startValue;
            controls[ctrlName] = new FormControl(startValue, validators);
          } else {
            startValue = (startValue === null || startValue === undefined) ? '' : startValue;
            controls[ctrlName] = new FormControl(startValue, validators);
          }
      }
    });
  
    // Validate required controls were created
    this.REQUIRED_CONTROLS.forEach(controlName => {
      if (this.debugMode && !controls[controlName]) {
        console.warn(`Missing required control: ${controlName}`);
      }
    });
    // Debug output
    if (this.debugMode) {
      console.debug('[generateSingleFormGroup] created controls:', {
        country: controls['country']?.value,
        state: controls['state']?.value,
        controls: Object.keys(controls)
      });
    }
  
    return this.fb.group(controls);
  }


  generateFormFromJson(
    struct: FormComponentData,
    options: { skipDefaults?: boolean; initialValues?: any; keepNulls?: boolean; initialArray?: any[]; } = {}
  ): FormGroup | FormArray {
    if (struct.multiple) {
      const initialGroups = options.initialArray?.map((item: any) =>
        this.generateSingleFormGroup(struct, { ...options, initialValues: item })
      ) || [this.generateSingleFormGroup(struct, options)];
      return this.fb.array(initialGroups);
    }
    const formGroup = this.generateSingleFormGroup(struct, options);
    return formGroup;
  }

  private createFormArray(struct: FormComponentData, options: any): FormArray {
    const initialGroups = options.initialArray?.map((item: any) =>
      this.generateSingleFormGroup(struct, { ...options, initialValues: item })
    ) || [this.generateSingleFormGroup(struct, options)];
    return this.fb.array(initialGroups);
  }

  private buildValidators(el: ElementData, subField?: string): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    const validationField = subField ? el[`${subField}Validation`] : el.validation;

    if (el.required || validationField === true) {
      if (el.type === 'checkbox') {
        validators.push(Validators.requiredTrue);
      } else {
        validators.push(Validators.required);
      }
    }


    if (typeof validationField === 'string' && validationField.trim() !== '') {
      try {
        validators.push(Validators.pattern(new RegExp(validationField)));
      } catch (err) {
        console.warn(`[DinFormJsonWorkerService] Invalid regex pattern: ${validationField}`);
      } 
    }

  return validators;
}


  replaceTextVariablesInObject(struct: any, variables: Record<string, any>): any {
    if (Array.isArray(struct)) {
      return struct.map(item => this.replaceTextVariablesInObject(item, variables));
    }
    if (struct && typeof struct === 'object') {
      const clone: any = {};
      for (const key of Object.keys(struct)) {
        clone[key] = this.replaceTextVariablesInObject(struct[key], variables);
      }
      return clone;
    }
    if (typeof struct === 'string') {
      return struct.replace(/{{\s*(\w+)\s*}}/g, (_, varName) =>
        variables[varName]?.toString() ?? ''
      );
    }
    return struct;
  }

  getCountryDropdownData(): CountryDropdown {
    return structuredClone(this.countryDropdownData); 
  }
  
}
