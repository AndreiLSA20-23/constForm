import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { StartComponent } from './base/start/start.component';
import { ReqComponent } from './base/req/req.component';
import { UserAuthComponent } from './user-auth/user-auth.component';
import { PrivacyPolicyComponent } from './base/privacy-policy/privacy-policy.component';
import { HistoryFormComponent } from './history-form/history-form.component'; // 👈 добавляем сюда
import { NgIf } from '@angular/common';
import { SsnMaskDirective } from './dirs/ssn-mask.directive';
import { RequirementsService } from './services/requirements.service';
import { DinFormJsonWorkerService } from './services/din-form-json-worker.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    StartComponent,
    ReqComponent,
    UserAuthComponent,
    HistoryFormComponent, // 👈 обязательно импортируем
    PrivacyPolicyComponent,
    NgIf,
    SsnMaskDirective,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  index = 1;
  ready = false;
  currentComponent: any = null;
  isPrivacyPolicyVisible = false;
  showHistoryForm = false; // 👈 новый флаг для переключения на HistoryForm

  private components = [
    null,
    StartComponent,    // 1
    ReqComponent,      // 2
    UserAuthComponent, // 3
  ];

  constructor(
    private requirementsService: RequirementsService,
    private dinFormService: DinFormJsonWorkerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const param = this.getParamFromUrl();
    localStorage.setItem('param', param);
    this.requirementsService.setParam(param);
    this.dinFormService.setRequirementsPath(`/requirements_${param}.json`);
    this.updateComponent();
  }

  private getParamFromUrl(): string {
    const m = window.location.search.match(/[?&]param=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : 'default';
  }

  private updateComponent() {
    this.ready = false;
    setTimeout(() => {
      this.currentComponent = this.components[this.index] || null;
      this.ready = true;
      this.cdr.detectChanges();
      //console.log(`[AppComponent] Showing component index=${this.index}`);
    }, 0);
  }

  canShowPrev(): boolean {
    return this.index >= 2 && this.index <= 3;
  }

  canShowNext(): boolean {
    return this.index >= 1 && this.index <= 2;
  }

  prev(): void {
    if (this.canShowPrev()) {
      this.index--;
      this.updateComponent();
    }
  }

  next(): void {
    if (this.canShowNext()) {
      this.index++;
      this.updateComponent();
    }
  }

  showPrivacyPolicy() {
    this.isPrivacyPolicyVisible = true;
  }

  hidePrivacyPolicy() {
    this.isPrivacyPolicyVisible = false;
  }

  // 👇 Вот это добавляем!
  onAuthSuccess() {
    console.log('[AppComponent] Authentication success received, showing HistoryFormComponent');
    this.showHistoryForm = true;
  }
}
