import {
  Component,
  Injector,
  OnInit,
  Inject,
  PLATFORM_ID,
  OnDestroy
} from '@angular/core';
import {
  NgComponentOutlet,
  NgIf,
  DatePipe,
  isPlatformBrowser,
  CommonModule
} from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerdatesComponent } from '../polls/perdates/perdates.component';
import { LicenseDetailsComponent } from '../polls/license-details/license-details.component';
import { DriverTrainingComponent } from '../polls/driver-training/driver-training.component';
import { ExpHistoryComponent } from '../polls/exp-history/exp-history.component';
import { AddAddressComponent } from '../polls/add-address/add-address.component';
import { FullResComponent } from '../polls/full-res/full-res.component';
import { HAZARDOUSComponent } from '../polls/hazardous/hazardous.component';
import { DRIVINGEXPERIENCEComponent} from '../polls/drivingexperience/drivingexperience.component';
import {CRIMINALINFORMATIONComponent} from '../polls/criminalinformation/criminalinformation.component';
import {IncidentDetailsComponent} from '../polls/incident-details/incident-details.component';
import { ReportGeneratorComponent } from '../polls/report-generator/report-generator.component';
import { HTTPFA } from '../models/start-data';

@Component({
  selector: 'app-history',
  standalone: true,
  templateUrl: './history-form.component.html',
  imports: [
    NgIf,
    NgComponentOutlet,
    DatePipe,
    FormsModule,
    CommonModule,
    PerdatesComponent,
    LicenseDetailsComponent,
    DriverTrainingComponent,
    ExpHistoryComponent,
    AddAddressComponent,
    FullResComponent,
    HAZARDOUSComponent,
    DRIVINGEXPERIENCEComponent,
    CRIMINALINFORMATIONComponent,
    IncidentDetailsComponent,
    ReportGeneratorComponent
  ],
  styleUrls: ['./history-form.component.scss']
})
export class HistoryFormComponent implements OnInit, OnDestroy {
  apiUrl = HTTPFA.HISTORY;
  responseData: any = null;
  index: number = 1;
  currentComponent: any = null;
  customInjector!: Injector;
  prefillStatusMap: Map<number, boolean> = new Map();
  prefillStatusReady: boolean = false;

  currentUserSSN: string | null = null;
  currentUserBday: string | null = null;
  currentUserParam: string = 'default';

  private readonly components = [
    null,
    PerdatesComponent,
    LicenseDetailsComponent,
    DriverTrainingComponent,
    AddAddressComponent,
    ExpHistoryComponent,
    FullResComponent,
    HAZARDOUSComponent,
    DRIVINGEXPERIENCEComponent,
    CRIMINALINFORMATIONComponent,
    IncidentDetailsComponent,
    ReportGeneratorComponent
  ];

  private pollingInterval: any = null;
  private readonly pollingDelay = 10000;

  constructor(
    private injector: Injector,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.currentUserSSN = localStorage.getItem('currentUserSSN');
      this.currentUserBday = localStorage.getItem('currentUserBday');
      this.currentUserParam = localStorage.getItem('currentUserParam') || 'default';

      this.customInjector = Injector.create({
        providers: [
          { provide: 'ssn', useValue: this.currentUserSSN },
          { provide: 'bday', useValue: this.currentUserBday },
          { provide: 'param', useValue: this.currentUserParam },
        ],
        parent: this.injector
      });

      this.fetchHistory();
      this.checkAllPrefillBlocks();
      this.startPollingPrefillStatus();
    }

    this.updateComponent();
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  fetchHistory(): void {
    if (!this.currentUserSSN || !this.currentUserBday) return;

    const url = `${this.apiUrl}/${this.currentUserSSN}?bday=${this.currentUserBday}&param=${this.currentUserParam}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => (this.responseData = data))
      .catch(() => (this.responseData = null));
  }

  async checkAllPrefillBlocks(): Promise<void> {
    this.prefillStatusReady = false;
    if (!this.currentUserSSN || !this.currentUserBday) return;

    const results: [number, boolean][] = [];

    for (let index = 1; index < this.components.length; index++) {
      const componentKey = this.getComponentKeyByIndex(index);
      const url = HTTPFA.FORM_DATA(componentKey, this.currentUserSSN, this.currentUserBday, this.currentUserParam);

      try {
        const res = await fetch(url);
        if (!res.ok) {
          results.push([index, false]);
          continue;
        }
        const json = await res.json();
        const data = json?.data;
        const isFilled = this.isComponentFilled(data);

        results.push([index, isFilled]);
      } catch (err) {
        results.push([index, false]);
      }
    }

    for (const [index, filled] of results) {
      this.prefillStatusMap.set(index, filled);
      if (index === this.index && filled) this.updateComponent();
    }

    this.prefillStatusReady = true;
  }

  private isComponentFilled(data: any): boolean {
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (data.items && Array.isArray(data.items)) return data.items.length > 0;
    if (typeof data === 'object') {
      return Object.entries(data).some(([_, val]) => {
        if (typeof val === 'object') return this.isComponentFilled(val);
        if (typeof val === 'boolean') return true;
        return val !== '' && val !== null && val !== undefined;
      });
    }
    return false;
  }

  private startPollingPrefillStatus(): void {
    if (!this.currentUserSSN || !this.currentUserBday) return;

    this.pollingInterval = setInterval(() => {
      this.checkAllPrefillBlocks();
    }, this.pollingDelay);
  }

  next(): void {
    if (this.canProceed) {
      this.index++;
      this.updateComponent();
    }
  }

  prev(): void {
    if (this.canShowPrev()) {
      this.index--;
      this.updateComponent();
    }
  }

  updateComponent(): void {
    this.currentComponent = this.components[this.index] || null;
  }

  canShowPrev(): boolean {
    return this.index > 1;
  }

  get canProceed(): boolean {
    return this.prefillStatusMap.get(this.index) === true;
  }

  get completionProgress(): number {
    return Math.round((this.index / (this.components.length - 1)) * 100);
  }

  private getComponentKeyByIndex(index: number): string {
    switch (index) {
      case 1: return 'app-perdates';
      case 2: return 'app-license-details';
      case 3: return 'app-driver-training';
      case 4: return 'add-address';
      case 5: return 'experience-history';
      case 6: return 'app-full-res';
      case 7: return 'app-hazardous';
      case 8: return 'app-drivingexperience';
      case 9: return 'app-criminalinformation';
      case 10: return 'app-incident-details';
      case 11: return 'app-report-generator';
      default: return '';
    }
  }
}
