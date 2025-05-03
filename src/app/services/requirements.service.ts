import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface IStartData {
  sampleCmpName: string;
  sampleCmpAddress: string;
  homeHistory: number;
  driveLicHistory: number;
  empHistory: number;
  email: string;
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
  }

  getUrl(): string {
    return this.url;
  }

  /**
   * Загружает данные из выбранного файла JSON и приводит их к IStartData
   */
  getStartData(): Observable<IStartData> {
    return this.http
      .get<{ variables: Record<string, any> }>(this.url)
      .pipe(
        map(({ variables: v }) => ({
          sampleCmpName: v['companyNameConst'],
          sampleCmpAddress: v['sampleCmpAddressConst'],
          homeHistory: v['homeHistoryConst'],
          driveLicHistory: v['driveLicHistoryConst'],
          empHistory: v['empHistoryConst'],
          email: v['emailConst'],
          personPhoneOrg: v['personPhoneOrgConst'],
          age: v['ageConst'],
          felonyConvictions: v['felonyConvictionsConst'],
          trafficAccidents: v['trafficAccidentsConst']
        }))
      );
  }
}
