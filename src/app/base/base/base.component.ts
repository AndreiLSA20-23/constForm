//base.**.ts
import { Directive, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
  FormArray,
} from '@angular/forms';
import {
  DinFormJsonWorkerService,
  RequirementsData,
  FormComponentData,
  ElementData
} from '../../services/din-form-json-worker.service';
import { Subject } from 'rxjs';

@Directive()
export abstract class BaseComponent implements OnInit {
  public requirementsReady$ = new Subject<void>();
  processedData!: FormComponentData;

  // Форма может быть либо FormGroup (монорежим), либо FormArray (полиформа)
  form!: FormGroup | FormArray;

  // Флаги загрузки и сообщение об ошибке
  isLoading = true;
  errorMessage = '';

  // Состояния для yes/no элементов (ключ – имя контрола)
  yesNoStates: { [key: string]: string } = {};

  // Для работы с dropdown страны – запоминаем последнее выбранное значение по индексу
  private lastLoggedCountry: { [key: number]: string } = {};
  private countryLogCount=0;
  protected _logCount = 0;

  // Пагинация: текущая страница и список ключей страниц
  currentPage: string = 'pagen_0';
  pageKeys: string[] = [];

  /**
   * Название компонента, чтобы dinFormService знал, какие данные грузить из JSON.
   * Реализуется в наследниках (например, componentName = 'app-driver-training').
   */
  protected abstract componentName: string;

  constructor(
    protected dinFormService: DinFormJsonWorkerService,
    protected cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRequirements();
  }

  /**
   * Возвращает FormGroup для заданного индекса в FormArray либо сам FormGroup (если он один).
   */
  protected getFormGroupAt(index: number): FormGroup | null {
    if (this.form instanceof FormGroup) {
      return this.form;
    } else if (this.form instanceof FormArray) {
      if (this.form.length > index) {
        return this.form.at(index) as FormGroup;
      } else {
        console.error(
          `[BaseComponent] FormArray index ${index} is out of bounds. Length: ${this.form.length}`
        );
      }
    }
    return null;
  }

  /**
   * Возвращает FormGroup. Если форма — это массив, берёт выбранный элемент (если задан) или первый.
   */
  protected getFormGroup(): FormGroup | null {
    if (this.form instanceof FormGroup) {
      return this.form;
    } else if (this.form instanceof FormArray && this.form.length > 0) {
      const selectedIndex = (this as any).selectedIndex;
      if (
        selectedIndex !== undefined &&
        selectedIndex !== null &&
        this.form.length > selectedIndex
      ) {
        return this.form.at(selectedIndex) as FormGroup;
      }
      return this.form.at(0) as FormGroup;
    }
    return null;
  }

  /**
   * Рекурсивно удаляет из объекта поля со значением пустой строки, null или undefined.
   */
  protected pruneEmptyFields(obj: any): any {
    if (Array.isArray(obj)) {
      return obj
        .map(item => this.pruneEmptyFields(item))
        .filter(
          item => item !== undefined && item !== null && item !== ''
        );
    } else if (obj !== null && typeof obj === 'object') {
      const pruned: any = {};
      Object.keys(obj).forEach(key => {
        const value = this.pruneEmptyFields(obj[key]);
        if (value !== '' && value !== null && value !== undefined) {
          pruned[key] = value;
        }
      });
      return pruned;
    }
    return obj;
  }

  /**
   * Обработка переключения yes/no.
   * При выборе "yes" динамически добавляются подэлементы (subElements),
   * при выборе "no" – удаляются.
   */
  onYesNoChange(el: ElementData, value: string, index: number = 0): void {
    const controlName = el.formControlName || el.id;
    this.yesNoStates[controlName] = value;
    const formGroup = this.getFormGroupAt(index);
    if (!formGroup) {
      console.error(
        `[BaseComponent] No FormGroup found for index ${index}`
      );
      return;
    }
    formGroup.get(controlName)?.setValue(value, { emitEvent: false });
    if (el.subElements) {
      if (value === 'yes') {
        el.subElements.forEach((subEl: ElementData) => {
          if (subEl.type === 'form' && subEl.formGroup) {
            if (!formGroup.contains(subEl.formGroup)) {
              const nestedForm = this.dinFormService.generateFormFromJson({
                id: subEl.id || 'auto_generated_id',
                type: 'form',
                elements: subEl.elements || []
              }) as FormGroup;
              formGroup.addControl(subEl.formGroup, nestedForm);
              //console.log([BaseComponent] Added nested form control "${subEl.formGroup}" at index ${index}`);
            }
          } else if (subEl.formControlName) {
            if (!formGroup.contains(subEl.formControlName)) {
              formGroup.addControl(
                subEl.formControlName,
                new FormControl('')
              );
              //console.log(
              //  `[BaseComponent] Added control "${subEl.formControlName}" at index ${index}`
              //);
            }
          }
        });
      } else if (value === 'no') {
        el.subElements.forEach((subEl: ElementData) => {
          if (
            subEl.formControlName &&
            formGroup.contains(subEl.formControlName)
          ) {
            formGroup.removeControl(subEl.formControlName);
            //console.log(
            //  `[BaseComponent] Removed control "${subEl.formControlName}" at index ${index}`
            //);
          }
          if (
            subEl.type === 'form' &&
            subEl.formGroup &&
            formGroup.contains(subEl.formGroup)
          ) {
            formGroup.removeControl(subEl.formGroup);
            //console.log(
            //  `[BaseComponent] Removed nested form control "${subEl.formGroup}" at index ${index}`
            //);
          }
        });
      }
    }
    this.cd.detectChanges();
  }

  /**
   * Загружает JSON-данные (requirements.json), берёт нужный компонент по имени, создаёт форму.
   * Если данные содержат pages, также обрабатываем логику пагинации.
   */

  protected loadRequirements(): void {
  const filePath = this.dinFormService.getRequirementsPath();
  this.dinFormService.loadRequirements(filePath).subscribe({
    next: (data: RequirementsData) => {
      const componentData = this.dinFormService.getComponentData(this.componentName);
      if (!componentData) {
        this.errorMessage = `No data found for component "${this.componentName}".`;
        this.isLoading = false;
        console.error(`[BaseComponent] No component data found for: ${this.componentName}`);
        return;
      }

      const vars = data.variables || {};
      const replaced = this.dinFormService.replaceTextVariablesInObject(componentData, vars);
      this.processedData = replaced as FormComponentData;

      let dataForForm = { ...this.processedData };
      if (this.processedData['pages']) {
        const flatElements =
          this.findArrayInObject('elements', this.processedData['pages']) ||
          this.findArrayInObject('rows', this.processedData['pages']);
        if (flatElements) {
          dataForForm = { ...this.processedData, elements: flatElements };
        }
        this.pageKeys = Object.keys(this.processedData['pages']);
        this.currentPage = this.pageKeys.length > 0 ? this.pageKeys[0] : '';
      } else {
        this.pageKeys = [];
        this.currentPage = '';
      }

      this.form = this.dinFormService.generateFormFromJson(dataForForm);

      if (this.form instanceof FormArray) {
        for (let i = 0; i < this.form.length; i++) {
          this.initializeCountryAndState(undefined,i);
        }
      }

      this.isLoading = false;
      this.cd.detectChanges();
      this.requirementsReady$.next();
    },
    error: (err) => {
      this.errorMessage = 'Failed to load data.';
      this.isLoading = false;
      console.error('[BaseComponent] Error loading requirements:', err);
    }
  });
}


/** ищет имя country‑контрола в группе */
private _detectCountryCtrl(group: FormGroup): string | null {
  if (!group) {
    console.warn('[BaseComponent] ⚠️ _detectCountryCtrl: group is null or undefined');
    return null;
  }
 
  // 1) Самый частый и правильный вариант — exact match 'country'
  if (group.contains('country')) {
    return 'country';
  }

  // 2) Пытаемся найти по шаблону — что-то, оканчивающееся на "country" (например, 'birthCountry')
  const fallback = Object.keys(group.controls).find(key =>
    key.toLowerCase().endsWith('country')
  );


  // 3) Не найдено
  //console.error('[BaseComponent] 🚫 No country control found in group:', group);
  return null;
}


/** по имени страны формирует имя штата: usaCountry → state */
private _deduceStateCtrl(countryCtrl: string): string {
  // 1) Если countryCtrl — не "country", но форма содержит "state", возвращаем её
  if (countryCtrl !== 'country') {
    if (this.form instanceof FormGroup && this.form.contains('state')) {
      console.warn(`[BaseComponent] ⚠️ Using fallback state control: "state" (detected for "${countryCtrl}")`);
      return 'state';
    }
  }
  return 'state';
}

protected initializeCountryAndState(form?: FormGroup, index: number = 0): void {
  const group = form ?? (this.form instanceof FormGroup
    ? this.form
    : this.getFormGroupAt(index));

  if (!group) return;

  const countryCtrlName = this._detectCountryCtrl(group);
  if (!countryCtrlName) return;

  const stateCtrlName = this._deduceStateCtrl(countryCtrlName);
  const countryRaw = group.get(countryCtrlName)?.value;
  const country = typeof countryRaw === 'string' ? countryRaw.trim() : '';
  const stateRaw = group.get(stateCtrlName)?.value;

  if (!country) {
    if (group.contains(stateCtrlName)) {
      group.removeControl(stateCtrlName);
      if (this._logCount++ < 30) console.log(`[BaseComponent] ❌ Removed "state" control due to empty country`);
    }
    return;
  }

  const countryCtrl = group.get(countryCtrlName);
  if (countryCtrl?.value !== country) {
    countryCtrl?.setValue(country, { emitEvent: false });
  }

  const hasStates =
    this.countryDropdownData.stateOptions.hasOwnProperty(country) &&
    Array.isArray(this.countryDropdownData.stateOptions[country]) &&
    this.countryDropdownData.stateOptions[country].length > 0;

  if (hasStates) {
    if (!group.contains(stateCtrlName)) {
      // Восстанавливаем state если есть, иначе пусто
      group.addControl(stateCtrlName, new FormControl(stateRaw || ''));
      if (this._logCount++ < 30) console.log(`[BaseComponent] ➕ Added state control "${stateCtrlName}" with value:`, stateRaw);
    } else if (group.get(stateCtrlName)?.value === undefined || group.get(stateCtrlName)?.value === null) {
      group.get(stateCtrlName)?.setValue(stateRaw || '', { emitEvent: false });
      if (this._logCount++ < 30) console.log(`[BaseComponent] 🔁 Patched empty state "${stateCtrlName}" with value:`, stateRaw);
    }
  } else {
    if (group.contains(stateCtrlName)) {
      group.removeControl(stateCtrlName);
      if (this._logCount++ < 30) console.log(`[BaseComponent] ❌ Removed unused state control for country: ${country}`);
    }
  }

  this.cd.detectChanges();
}






  /**
   * Возвращает FormGroup (или бросает ошибку, если не удалось получить).
   */
  get mainFormGroup(): FormGroup {
    const fg = this.getFormGroup();
    if (!fg) {
      throw new Error('FormGroup is not available.');
    }
    return fg;
  }

  /**
   * Возвращаем полную форму как есть (FormGroup или FormArray).
   */
  get fullForm(): FormGroup | FormArray {
    return this.form;
  }

  /**
   * Удобный геттер, если форма — FormArray.
   */
  get formArray(): FormArray {
    return this.form as FormArray;
  }

  get isFormGroup(): boolean {
    return this.fullForm instanceof FormGroup;
  }

  get isFormArray(): boolean {
    return this.fullForm instanceof FormArray;
  }

  /**
   * Отладочный метод для вывода типа контрола.
   */
  isFormOrArray(control: FormGroup | FormArray): boolean {
    //console.log('Control type:', control);
    return control instanceof FormGroup;
  }

  /**
   * Возвращает массив FormGroup, если форма — FormArray.
   */
  public get formGroups(): FormGroup[] {
    if (this.form instanceof FormArray) {
      return this.form.controls as FormGroup[];
    }
    return [];
  }

  /**
   * Поиск массива (key) в переданном объекте (obj).
   * Используется для поиска 'elements' или 'rows' при flatten страниц.
   */
  protected findArrayInObject(key: string, obj: any): any[] | null {
    if (!obj || typeof obj !== 'object') {
      return null;
    }
    if (Array.isArray(obj[key])) {
      return obj[key];
    }
    for (const prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        const found = this.findArrayInObject(key, obj[prop]);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Текущие данные страницы для рендера (используется при многостраничной логике).
   */
  get currentPageData(): any {
    if (!this.processedData) {
      return {};
    }
    const pagesData =
      this.processedData['pages'] ||
      this.processedData['app-text-display'];
    if (pagesData && this.pageKeys.length > 0) {
      return pagesData[this.currentPage];
    }
    return this.processedData;
  }

  /**
   * Получаем массив 'rows' или 'elements' для текущей страницы (используется в шаблонах).
   */
  getRows(): any[] {
    const data = this.currentPageData;
    if (!data) {
      return [];
    }
    let rows = this.findArrayInObject('rows', data);
    if (rows) {
      return rows;
    }
    rows = this.findArrayInObject('elements', data);
    if (rows) {
      return rows;
    }
    return [];
  }

  getRowsForPage(pageKey: string): any[] {
    const pagesData =
      this.processedData['pages'] ||
      this.processedData['app-text-display'];
    const page = pagesData ? pagesData[pageKey] : null;
    if (!page) {
      return [];
    }
    let rows = this.findArrayInObject('rows', page);
    if (!rows) {
      rows = this.findArrayInObject('elements', page);
    }
    return rows || [];
  }

  /**
   * Переход на предыдущую страницу (для многостраничного режима).
   */
  goPrev(): void {
    const currentIndex = this.pageKeys.indexOf(this.currentPage);
    if (currentIndex > 0) {
      this.currentPage = this.pageKeys[currentIndex - 1];
    }
  }

  /**
   * Переход на следующую страницу (для многостраничного режима).
   */
  goNext(): void {
    if (!this.isProcessedPageValid()) {
      return;
    }
    const currentIndex = this.pageKeys.indexOf(this.currentPage);
    if (currentIndex < this.pageKeys.length - 1) {
      this.currentPage = this.pageKeys[currentIndex + 1];
    } else {
      if (this.isFormArray) {
        this.onSubmitFormArray();
      } else {
        this.onSubmitSingleForm();
      }
    }
  }

  /**
   * Методы, которые должны быть реализованы в наследующих компонентах.
   */
  abstract onCancel(): void;
  abstract onSubmitFormArray(): void;
  abstract onSubmitSingleForm(): void;

  // Геттеры для шаблона
  get processedElements(): any[] {
    return this.getRows();
  }

  get processedPageKeys(): string[] {
    return this.pageKeys;
  }

  get currentProcessedPage(): string {
    return this.currentPage;
  }

  getProcessedRowsForPage(pageKey: string): any[] {
    return this.getRowsForPage(pageKey);
  }

  goProcessedPrev(): void {
    this.goPrev();
  }

  goProcessedNext(): void {
    this.goNext();
  }

  /**
   * Проверка валидности текущей страницы.
   */
  isProcessedPageValid(): boolean {
    const group = this.getFormGroup();
    if (!group) {
      return false;
    }
    const rows = this.getRows();
    let valid = true;
    rows.forEach(row => {
      if (row.formControlName && group.contains(row.formControlName)) {
        const control = group.get(row.formControlName);
        if (control && control.invalid) {
          valid = false;
        }
      }
    });
    return valid;
  }

  /**
   * Геттер для countryDropdownData — чтобы шаблон имел доступ.
   */
  get countryDropdownData() {
    return this.dinFormService.getCountryDropdownData();
  }

  /**
   * Методы для обработки списка штатов/провинций и изменения страны в форме.
   */
  public getStatesHandler(i: number): () => string[] {
    return () => {
        console.log(`[getStatesHandler] called for index: ${i}`);
        const states = this.getStatesForSelectedCountry(i);
        console.log(`[getStatesHandler] result for index ${i}:`, states);
        return states;
    };
}


  public getCountryChangeHandler(
    i: number
  ): (event: Event) => void {
    return (event: Event) => this.onCountryChange(event, i);
  }
  

  /**
   * Обработчик изменения страны: устанавливает значение контрола "country" и добавляет/удаляет контрол "state".
   */
  public onCountryChange = (event: Event, index: number): void => {
    const select = event.target as HTMLSelectElement;
    const selectedCountry = select.value.trim();
  
    // Логируем изменение страны только если оно отличается от предыдущего значения
    if (this.lastLoggedCountry[index] !== selectedCountry) {
      //console.log(
      //  `[BaseComponent] onCountryChange triggered for index ${index}. Selected country: "${selectedCountry}"`
      //);
      this.lastLoggedCountry[index] = selectedCountry;
    }
  
    // Получаем FormGroup для текущего элемента
    const group = this.getFormGroupAt(index);
    if (!group) {
      //console.error(
      //  `[BaseComponent] No FormGroup available in onCountryChange for index ${index}`
      //);
      return;
    }
  
    // Устанавливаем значение "country" в текущей группе
    if (group.contains('country')) {
      group.get('country')?.setValue(selectedCountry, { emitEvent: false }); // Отключаем события, чтобы избежать циклических вызовов
      //console.log(
      //  `[BaseComponent] Set value for "country" control: ${selectedCountry}`
      //);
    } else {
      //console.error(
      //  `[BaseComponent] No "country" control found in group at index ${index}`
      //);
    }
  
    // Обновляем контрол "state" в зависимости от наличия опций для выбранной страны
    const hasStates =
      this.countryDropdownData.stateOptions.hasOwnProperty(selectedCountry);
  
    if (hasStates) {
      if (!group.contains('state')) {
        // Добавляем контрол "state" с валидацией
        group.addControl(
          'state',
          new FormControl('', Validators.required)
        );
        //console.log(
        //  `[BaseComponent] Added "state" control with required validator for index ${index}`
        //);
      }
  
      // Проверяем, соответствует ли текущее значение "state" списку доступных штатов
      const statesList = this.countryDropdownData.stateOptions[selectedCountry];
      const currentState = group.get('state')?.value;
  
      if (!statesList.includes(currentState)) {
        group.get('state')?.setValue('');
        //console.log(
        //  `[BaseComponent] Reset "state" control value because "${currentState}" is not in the list for "${selectedCountry}"`
        //);
      }
    } else {
      // Удаляем контрол "state", если для страны нет штатов
      if (group.contains('state')) {
        group.removeControl('state');
        //console.log(
        //  `[BaseComponent] Removed "state" control for index ${index} because no states for "${selectedCountry}"`
        //);
      }
    }
  
    // Принудительно обновляем представление
    this.cd.detectChanges();
  };

  /**
   * Возвращает список штатов/провинций для выбранной страны.
   */
  // ↓ замените весь метод
  public getStatesForSelectedCountry = (index: number): string[] => {
    let logPrefix = `[getStatesForSelectedCountry] index=${index} |`;
  
    if (this.form instanceof FormGroup) {
      const states = this._statesForGroup(this.form);
      console.log(`${logPrefix} FormGroup detected (editForm/modal). Country:`, this.form.get('country')?.value, '→ States:', states);
      return states;
    }
  
    const group = this.getFormGroupAt(index);
    if (!group) {
      console.warn(`${logPrefix} No FormGroup at index! Returning [].`);
      return [];
    }
    const country = group.get('country')?.value;
    const states = this._statesForGroup(group);
    console.log(`${logPrefix} FormArray mode. Group country:`, country, '→ States:', states);
    return states;
  };
  

/* приватный помощник: возвращает список штатов для конкретного FormGroup */
private _statesForGroup(group: FormGroup | null): string[] {
  if (!group) { return []; }

  const countryCtrl = this._detectCountryCtrl(group);
  if (!countryCtrl) { return []; }

  const country = String(group.get(countryCtrl)!.value || '').trim();
  if (!country) { return []; }

  const states = this.countryDropdownData.stateOptions[country];
  return Array.isArray(states) && states.length ? states : [];
}



  /**
   * При отправке формы (submit) можно предварительно очистить payload от пустых полей,
   * чтобы в JSON не записывались ненужные пустые переменные.
   */
  protected preparePayload(rawValue: any): any {
    return this.pruneEmptyFields(rawValue);
  }
  protected removeOrphanControlsFromPayload(group: FormGroup, payload: any): any {
  const controlsInForm = Object.keys(group.controls);
  return Object.keys(payload).reduce((acc, key) => {
    if (controlsInForm.includes(key)) {
      acc[key] = payload[key];
    } else {
      console.log(`[BaseComponent]  Removed orphan field from payload: ${key}`);
    }
    return acc;
  }, {} as any);
}
}
