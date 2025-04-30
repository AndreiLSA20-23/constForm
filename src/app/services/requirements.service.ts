import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface IStartData {
  sampleCmpName: string;
  sampleCmpAddress: string;
  homeHistory: number;
  driveLicHistory: number;
  empHistory: number;
  phone: string;
  personPhoneOrg: string;
  age: number;
  felonyConvictions: number;
  trafficAccidents: number;
}

@Injectable({ providedIn: 'root' })
export class RequirementsService {
  private url = '/requirements_default.json'; // 🛠 Путь по умолчанию

  constructor(private http: HttpClient) {}

  /**
   * Устанавливает путь к нужному JSON-файлу по параметру
   */
  setParam(param: string): void {
    // Меняем путь, чтобы использовать динамический параметр
    this.url = `/requirements_${param}.json`;
    console.log(`[RequirementsService] 🔵 Установлен путь к JSON: ${this.url}`);
  }

  getUrl(): string {
    return this.url;
  }

  /**
   * Загружает данные из выбранного файла JSON и приводит их к IStartData
   */
  getStartData(): Observable<IStartData> {
    console.log(`[RequirementsService] 📦 Пытаемся загрузить JSON: ${this.url}`);
    return this.http
      .get<{ variables: Record<string, any> }>(this.url)
      .pipe(
        map(({ variables: v }) => ({
          sampleCmpName: v['companyNameConst'],
          sampleCmpAddress: v['sampleCmpAddressConst'],
          homeHistory: v['homeHistoryConst'],
          driveLicHistory: v['driveLicHistoryConst'],
          empHistory: v['empHistoryConst'],
          phone: '', // Если вам нужно, подставьте нужные данные для телефона
          personPhoneOrg: v['personPhoneOrgConst'],
          age: v['ageConst'],
          felonyConvictions: v['felonyConvictionsConst'],
          trafficAccidents: v['trafficAccidentsConst']
        }))
      );
  }
}
