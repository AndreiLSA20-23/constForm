import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';
import { SsnMaskDirective } from '../dirs/ssn-mask.directive';
import { MathCaptchaComponent } from '../adt/math-captcha/math-captcha.component';
import { HistoryFormComponent } from '../history-form/history-form.component'; // Обязательно импортируем!
import {HTTPFA} from '../models/start-data';


@Component({
  selector: 'app-user-auth',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    NgIf,
    SsnMaskDirective,
    MathCaptchaComponent,
    HistoryFormComponent,
  ],
  templateUrl: './user-auth.component.html',
  styleUrls: ['./user-auth.component.scss'],
})
export class UserAuthComponent {
  authForm: FormGroup;
  minAge = 23;
  maxAge = 75;
  message = '';
  captchaPassed = false;
  isLoading = false;
  showHistoryForm = false; // 👉 Флаг для перехода на <app-history>

  constructor(private fb: FormBuilder) {
    this.authForm = this.fb.group({
      ssn: ['', [Validators.required, Validators.pattern(/^\d{3}-\d{2}-\d{4}$/)]],
      dateOfBirth: ['', [Validators.required, this.validateAge.bind(this), this.validateFutureDate]],
      noCriminalRecord: [false, Validators.requiredTrue],
      acceptTerms: [false, Validators.requiredTrue],
    });
  }

  private validateAge(control: AbstractControl) {
    const dateOfBirth = new Date(control.value);
    if (isNaN(dateOfBirth.getTime())) return { invalidDate: true };
    const age = this.calculateAge(dateOfBirth);
    if (age < this.minAge) return { tooYoung: true };
    if (age > this.maxAge) return { tooOld: true };
    return null;
  }

  private validateFutureDate(control: AbstractControl) {
    const dateOfBirth = new Date(control.value);
    const today = new Date();
    return dateOfBirth > today ? { futureDate: true } : null;
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    return age;
  }

  onMathCaptchaVerified(passed: boolean) {
    this.captchaPassed = passed;
    //console.log(`[UserAuthComponent] Captcha verification status: ${passed}`);
  }

  async onSubmit() {
    if (!this.authForm.valid) {
      this.message = 'Form is invalid. Please check all fields.';
      console.warn('[UserAuthComponent] Form validation failed.');
      return;
    }

    if (!this.captchaPassed) {
      this.message = 'Captcha failed. Please solve it correctly.';
      console.warn('[UserAuthComponent] Captcha not passed.');
      return;
    }

    const param = localStorage.getItem('param') || 'default';

    const formData = {
      ssn: this.authForm.get('ssn')?.value,
      bday: this.authForm.get('dateOfBirth')?.value,
      param: param,
    };
    console.log('[UserAuthComponent]', formData);


    this.isLoading = true;
    this.message = '';

    try {
      console.log('[UserAuthComponent] Sending SSN check request...');
      const checkResponse = await fetch(HTTPFA.CHECKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

    if (!checkResponse.ok) {
      const errorData = await checkResponse.json();
      console.error('[UserAuthComponent] SSN check failed with error:', errorData);
      throw new Error(errorData.detail || 'SSN check failed');
    }

    console.log('[UserAuthComponent] Sending file create/update request...');
    const fileResponse = await fetch(HTTPFA.UPSET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!fileResponse.ok) {
      const errorData = await fileResponse.json();
      console.error('[UserAuthComponent] File creation/update failed:', errorData);
      throw new Error(errorData.detail || 'File creation failed');
    }

    localStorage.setItem('currentUserSSN', formData.ssn);
    localStorage.setItem('currentUserBday', formData.bday);
    localStorage.setItem('currentUserParam', formData.param);

    this.message = 'Authentication successful!';
    this.showHistoryForm = true;

  } catch (error: any) {
    this.message = `Error: ${error.message}`;
  } finally {
    this.isLoading = false;
  }
}
/**  async onSubmit() {
  if (!this.authForm.valid) {
    this.message = 'Form is invalid. Please check all fields.';
    console.warn('[UserAuthComponent] Form validation failed.');
    return;
  }

  if (!this.captchaPassed) {
    this.message = 'Captcha failed. Please solve it correctly.';
    console.warn('[UserAuthComponent] Captcha not passed.');
    return;
  }

  const param = localStorage.getItem('param') || 'default';

  const formData = {
    ssn: this.authForm.get('ssn')?.value,
    bday: this.authForm.get('dateOfBirth')?.value,
    param: param,
  };

  this.isLoading = true;
  this.message = '';

  try {
    console.log('[UserAuthComponent] Checking SSN...');
    await this.postJson(HTTPFA.CHECKER, formData);

    console.log('[UserAuthComponent] Creating/Updating file...');
    await this.postJson(HTTPFA.UPSET, formData);

    localStorage.setItem('currentUserSSN', formData.ssn);
    localStorage.setItem('currentUserBday', formData.bday);
    localStorage.setItem('currentUserParam', formData.param);

    this.message = 'Authentication successful!';
    this.showHistoryForm = true;

  } catch (error: any) {
    this.message = `Error: ${error.message}`;
    console.error('[UserAuthComponent] onSubmit error:', error);
  } finally {
    this.isLoading = false;
  }
}

/** Вспомогательная функция для POST-запросов */
/*private async postJson(url: string, body: any): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || '';
    } catch (e) {
      console.warn('[postJson] Failed to parse error JSON');
    }
    throw new Error(errorDetail || `Request to ${url} failed`);
  }
}*/

}
