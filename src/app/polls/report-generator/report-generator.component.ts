import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HTTPFA } from '../../models/start-data';

@Component({
  selector: 'app-report-generator',
  standalone: true,
  imports: [],
  templateUrl: './report-generator.component.html',
  styleUrl: './report-generator.component.scss'
})
export class ReportGeneratorComponent {
  constructor(private http: HttpClient) {}

  downloadPDF(): void {
    const ssn = localStorage.getItem('currentUserSSN') || '';
    const bday = localStorage.getItem('currentUserBday') || '';
    const param = localStorage.getItem('currentUserParam') || 'default';

    if (!ssn || !bday) {
      alert('SSN и Bday не найдены в localStorage');
      return;
    }

    const url = ` FORM_DATA: (componentKey: string, ssn: string, bday: string, param)`;
    window.open(url, '_blank');
  }
}
