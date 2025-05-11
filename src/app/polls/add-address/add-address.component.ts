import { Component, OnInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import {
  ReactiveFormsModule, FormGroup, FormControl,
  Validators, AbstractControl, ValidationErrors
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { TimestoreService }  from '../../services/timestore.service';
import { EditArrayService }  from '../../services/edit-array-service.service';
import { AddAddressService } from '../../services/add-address-service.service';
import { RequirementsService, IStartData } from '../../services/requirements.service';
import { IAddressData } from '../../models/data.model';
import { HTTPFA } from '../../models/start-data';

@Component({
  selector:    'app-add-address',
  standalone:  true,
  templateUrl: './add-address.component.html',
  styleUrls:   ['./add-address.component.scss'],
  imports:     [CommonModule, ReactiveFormsModule, NgIf, NgForOf]
})
export class AddAddressComponent implements OnInit, AfterViewChecked {
  @ViewChild('countrySelect') countrySelectRef!: ElementRef;
  stor!: IStartData;

  isDirty = false;

  isModalOpen = false;
  editIndex: number | null = null;

  addressForm!: FormGroup;
  countries: string[] = [];
  states:    string[] = [];
  storage:   IAddressData[] = [];
  gaps:      { startDate: Date; endDate: Date }[] = [];

  maxMonths = 0;

  private ssn  = localStorage.getItem('currentUserSSN')  ?? '';
  private bday = localStorage.getItem('currentUserBday') ?? '';
  private param = localStorage.getItem('currentUserParam') ?? '';

  constructor(
    private addAddrSrv: AddAddressService,
    private editSrv:    EditArrayService<IAddressData>,
    private timeSrv:    TimestoreService,
    private http:       HttpClient,
    private reqSvc: RequirementsService

  ) {
    this.initForm();
    this.countries = this.addAddrSrv.getCountries();
  }

  ngOnInit(): void {
  this.addressForm.statusChanges.subscribe(status => {
    // Здесь можно обработать изменение статуса формы, если нужно
  });

  if (!this.ssn) {
    console.warn('[AddAddress] no SSN for prefill');
    return;
  }

  // ✅ Загружаем стартовые данные (homeHistory) перед префиллом
  this.reqSvc.getStartData().subscribe({
    next: (startData: IStartData) => {
      if (startData?.homeHistory) {
        this.maxMonths = startData.homeHistory * 12;
        this.timeSrv.setAge(startData.homeHistory);
      } else {
        console.warn('[AddAddress] ⚠️ Стартовые данные без homeHistory');
        this.maxMonths = 120; // Фолбек на 10 лет
      }

      // ✅ После загрузки стартовых данных, грузим префилл
      const url = HTTPFA.FORM_DATA('add-address', this.ssn, this.bday, this.param);
      this.http.get<any>(url).subscribe({
        next: (resp) => {
          const raw = resp?.data ?? [];
          this.storage = Array.isArray(raw) ? raw : [];

          this.timeSrv.storage = this.storage
            .filter(a => a && a.startDate && a.endDate)
            .map(a => ({
              startDate: new Date(a.startDate),
              endDate:   new Date(a.endDate)
            }));

          this.calculateGaps();
        },
        error: (err) => {
          console.error('[AddAddress] ❌ Ошибка загрузки префилла', err);
          this.storage = [];
          this.timeSrv.storage = [];
          this.calculateGaps();
        }
      });
    },
    error: (err) => {
      console.error('[AddAddress] ❌ Ошибка загрузки стартовых данных', err);
      this.maxMonths = 120; // Фолбек на 10 лет
      this.timeSrv.setAge(10);
      // Даже при ошибке стартовых данных пробуем загрузить префилл
      const url = HTTPFA.FORM_DATA('add-address', this.ssn, this.bday, this.param);
      this.http.get<any>(url).subscribe({
        next: (resp) => {
          const raw = resp?.data ?? [];
          this.storage = Array.isArray(raw) ? raw : [];
          if (!Array.isArray(raw)) {
            console.warn('[AddAddress] ⚠️ add-address не найден или не является массивом');
          }

          this.timeSrv.storage = this.storage
            .filter(a => a && a.startDate && a.endDate)
            .map(a => ({
              startDate: new Date(a.startDate),
              endDate:   new Date(a.endDate)
            }));

          this.calculateGaps();
        },
        error: (err2) => {
          console.error('[AddAddress] ❌ Ошибка загрузки префилла при fallback', err2);
          this.storage = [];
          this.timeSrv.storage = [];
          this.calculateGaps();
        }
      });
    }
  });
}

  isStateValid(): boolean {
  const c = this.addressForm.get('country')?.value;
  const s = this.addressForm.get('state')?.value;
  return c !== 'United States' || !!s;
}

  getInvalidKeys(): string[] {
  return Object.keys(this.addressForm.controls).filter(key => {
    const ctrl = this.addressForm.get(key);
    return ctrl && ctrl.invalid;
  });
}






  ngAfterViewChecked(): void {
    if (this.isModalOpen && this.countrySelectRef) {
      setTimeout(() => {
        this.countrySelectRef.nativeElement.focus();
      }, 0);
    }
  }

  private initForm() {
    this.addressForm = new FormGroup({
      country:      new FormControl('', Validators.required),
      state:        new FormControl(''),
      city:         new FormControl('', Validators.required),
      addressLine1: new FormControl('', Validators.required),
      addressLine2: new FormControl(''),
      zipCode:      new FormControl('', Validators.required),
      startDate:    new FormControl('', Validators.required),
      endDate:      new FormControl('', Validators.required)
    }, {
      validators: [ this.rangeValidator.bind(this),
                    this.overlapValidator.bind(this) ]
    });
  }

  openModal(idx?: number) {
    if (idx != null) {
      this.editIndex = idx;
      this.addressForm.patchValue(this.storage[idx]);
      //console.log('[MODAL OPEN] Edit mode. Loaded:', this.storage[idx]);
      this.onCountryChange();
      this.addressForm.markAllAsTouched();
      this.addressForm.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    } else {
      this.editIndex = null;
      //console.log('[MODAL OPEN] Add mode. Empty form');
      this.addressForm.reset();
    }
    this.isModalOpen = true;
  }

  closeModal() { this.isModalOpen = false; }

  saveFromModal() {
    this.isDirty = true;
    //console.group('[MODAL SUBMIT]');
    //console.log('Form value:', this.addressForm.value);
    //console.log('Form status:', this.addressForm.status);
   // console.log('Form errors:', this.addressForm.errors);

    if (this.addressForm.invalid) {
      console.warn('[AddAddress] ⚠️ Форма невалидна, скроллим к первому invalid полю');
      this.scrollToFirstInvalidControl();
      return;
    }

  Object.keys(this.addressForm.controls).forEach(key => {
    const ctrl = this.addressForm.get(key);
  });

  const addr = this.addressForm.value as IAddressData;
  const range = {
    startDate: new Date(addr.startDate),
    endDate:   new Date(addr.endDate)
  };

  // ⛔ временно удалим старый интервал перед валидацией
  if (this.editIndex !== null) {
    const prev = this.storage[this.editIndex];
    if (prev?.startDate && prev?.endDate) {
      this.timeSrv.removeInterval(new Date(prev.startDate), new Date(prev.endDate));
    }

  }

  // 🔍 Проверка перекрытия
  if (!this.timeSrv.isAddressValid(range)) {
    console.error('Date range overlaps');
    return;
  }

  if (this.editIndex === null && !this.isAddressUnique(addr)) {
    console.error('Duplicate address');
    return;
  }

  if (this.editIndex === null) {
    this.storage.push(addr);
  } else {
    this.storage[this.editIndex] = addr;
  }

  this.timeSrv.storage.push(range);
  this.refreshData();
  this.closeModal();

  console.groupEnd();
}




  persistAll(): void {
    if (this.gaps.length) {
      console.warn('[AddAddress] close gaps first!');
      return;
    }
    const cleaned = this.storage.filter(a => a && a.startDate && a.endDate && a.city);
    const payload = {
      ssn:  this.ssn,
      bday: this.bday,
      param: this.param,
      additional_data: {
        'add-address': cleaned
      }
    };
    console.log('[AddAddress] will persist payload:', payload);
    this.http.post(
      HTTPFA.UPSET,
      payload
    ).subscribe({
      next: ()   => console.log('[AddAddress] addresses saved'),
      error: err => console.error('[AddAddress] save error', err)
    });
    this.isDirty = false;
  }

  onCountryChange() {
  const c = this.addressForm.get('country')?.value;
  const stateControl = this.addressForm.get('state');

  // Получаем список штатов для выбранной страны
  this.states = c ? (this.addAddrSrv.getStatesForCountry(c) || []) : [];

  const isUSA = c === 'United States';

  if (isUSA) {
    stateControl?.setValidators(Validators.required);
    const stateValue = stateControl?.value;
    const isValid = this.states.includes(stateValue);
    
    if (!isValid) {
      console.warn('[onCountryChange] 🚫 State недействителен для США, очищаем поле.');
      stateControl?.setValue('');
    }
  } else {
    stateControl?.clearValidators();
    // не трогаем вручную введённое значение
  }

  stateControl?.updateValueAndValidity({ onlySelf: true, emitEvent: true });
}




  private refreshData() {
    this.calculateGaps();
  }

  private calculateGaps() {
    const intervals = this.storage
      .filter(a => a && a.startDate && a.endDate)
      .map(a => ({
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate)
      }));

    this.timeSrv.storage = intervals;
    this.gaps = this.timeSrv.calculateGaps(intervals, this.maxMonths);
  }

  private rangeValidator(c: AbstractControl): ValidationErrors | null {
    const s = new Date(c.get('startDate')?.value);
    const e = new Date(c.get('endDate')?.value);
    if (s && e) {
      if (s >= e) return { dateRangeInvalid: true };
      const m = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
      if (m < 1 || m > this.maxMonths) return { dateRangeInvalid: true };
    }
    return null;
  }

  private overlapValidator(c: AbstractControl): ValidationErrors | null {
  const s = new Date(c.get('startDate')?.value);
  const e = new Date(c.get('endDate')?.value);
  if (!s || !e) return null;

  const currentRange = { startDate: s, endDate: e };

  // ✅ Если редактируем, и даты не поменялись — пропускаем валидацию
  if (this.editIndex !== null) {
    const original = this.storage[this.editIndex];
    if (original) {
      const origStart = new Date(original.startDate);
      const origEnd = new Date(original.endDate);
      const isSameRange = origStart.getTime() === s.getTime() && origEnd.getTime() === e.getTime();

      if (isSameRange) {
        return null;
      }
    }
  }

  // ❌ Проверка на пересечение
  const isOverlap = this.timeSrv.storage.some(range => {
    return !(e <= range.startDate || s >= range.endDate);
  });

  return isOverlap ? { dateOverlap: true } : null;
}


  editAddress(i: number) {
    this.openModal(i);
  }

  removeAddress(i: number) {
    const old = this.storage[i];
    if (old?.startDate && old?.endDate) {
      this.timeSrv.removeInterval(new Date(old.startDate), new Date(old.endDate));
    }
    this.storage.splice(i, 1);
    this.refreshData();
  }

  private isAddressUnique(a: IAddressData): boolean {
    return !this.storage.some(b =>
      b.addressLine1 === a.addressLine1 &&
      b.addressLine2 === a.addressLine2 &&
      b.zipCode === a.zipCode &&
      b.startDate === a.startDate &&
      b.endDate === a.endDate
    );
  }

  fillFormWithGap(g: { startDate: Date, endDate: Date }) {
    this.addressForm.patchValue({
      startDate: g.startDate.toISOString().split('T')[0],
      endDate:   g.endDate.toISOString().split('T')[0]
    });
  }

  private scrollToFirstInvalidControl() {
    const firstInvalidControl: HTMLElement = document.querySelector(
      'form .ng-invalid'
    ) as HTMLElement;

    if (firstInvalidControl && typeof firstInvalidControl.scrollIntoView === 'function') {
      firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalidControl.focus();
    }
  }
}
