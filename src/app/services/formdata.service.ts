import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import{HTTPFA} from '../models/start-data';

@Injectable({
  providedIn: 'root'
})
export class FormDataService {
  private upsertUrl = HTTPFA.UPSET;

  constructor(private http: HttpClient) {}

  /**
   * Загружаем данные для указанного раздела (если требуется).
   * GET /forms/:sectionName
   */
  loadFormData(formSection: string): Observable<any> {
    const url = HTTPFA.LFD(formSection);
    console.info(`[FormDataService] loadFormData: Sending GET request to ${url}`);
    return this.http.get(url).pipe(
      map(response => {
        console.info(`[FormDataService] Form data for "${formSection}" loaded.`, response);
        return response;
      }),
      catchError(error => {
        console.error(`[FormDataService] Error loading form data for "${formSection}":`, error);
        return of(null);
      })
    );
  }

  /**
   * Метод создания данных. Преобразует form.value, извлекая ssn и bday,
   * а остальные поля помещает в additional_data под ключом, равным formSection.
   * Использует POST-запрос на единый эндпоинт.
   *
   * @param formSection - Идентификатор компонента (например, "app-perdates" или "app-per")
   * @param data - Значения формы, содержащие ssn, bday и остальные данные формы.
   */
  createFormData(formSection: string, data: any): Observable<any> {
  console.info(`[FormDataService] createFormData: Received data:`, data);
  const { ssn, bday, param, ...rest } = data;

  // Проверяем наличие обязательных полей
  if (!ssn || !bday) {
    console.error(`[FormDataService] Missing required fields: ssn or bday in data:`, data);
    return of(null);
  }

  const requestData = {
    ssn,
    bday,
    param,
    additional_data: {
      [formSection]: rest
    }
  };

  console.info(
    `[FormDataService] createFormData: Sending POST to ${this.upsertUrl}`, 
    requestData
  );
  return this.http.post(this.upsertUrl, requestData).pipe(
    tap(response => {
      console.info(
        `[FormDataService] Upsert response for "${formSection}":`, 
        response
      );
    }),
    map(response => response),
    catchError(error => {
      console.error(
        `[FormDataService] Error creating record for "${formSection}":`, 
        error
      );
      return of(null);
    })
  );
}

  /**
   * Метод обновления данных. Преобразует form.value аналогично createFormData,
   * но использует PUT-запрос для обновления записи.
   *
   * @param formSection - Идентификатор компонента (например, "app-perdates" или "app-per")
   * @param data - Значения формы, содержащие ssn, bday и остальные данные формы.
   */
  editFormData(formSection: string, data: any): Observable<any> {
    console.info(`[FormDataService] editFormData: Received data:`, data);
    const { ssn, bday, param, ...rest } = data;

    // Проверяем наличие обязательных полей
    if (!ssn || !bday) {
      console.error(`[FormDataService] Missing required fields: ssn or bday in data:`, data);
      return of(null);
    }

    const requestData = {
      ssn,
      bday,
      param,
      additional_data: {
        [formSection]: rest
      }
    };

    console.info(`[FormDataService] editFormData: Request data for "${formSection}":`, requestData);
    console.info(`[FormDataService] editFormData: Sending PUT request to ${this.upsertUrl}`);
    return this.http.put(this.upsertUrl, requestData).pipe(
      map(response => {
        console.info(`[FormDataService] Record for "${formSection}" updated successfully via upsert endpoint. Response:`, response);
        return response;
      }),
      catchError(error => {
        console.error(`[FormDataService] Error updating record for "${formSection}":`, error);
        return of(null);
      })
    );
  }


  editPartialFormData(formSection: string, data: any): Observable<any> {
    const url = HTTPFA.EPDF(formSection);
    console.info(`[FormDataService] editPartialFormData: Received data for partial edit in "${formSection}":`, data);
    console.info(`[FormDataService] editPartialFormData: Sending PATCH request to ${url}`);
    return this.http.patch(url, data).pipe(
      map(response => {
        console.info(`[FormDataService] Record for "${formSection}" partially edited successfully. Response:`, response);
        return response;
      }),
      catchError(error => {
        console.error(`[FormDataService] Error editing record for "${formSection}":`, error);
        return of(null);
      })
    );
  }

  /**
   * Объединённый метод upsert, если необходимо вызвать один и тот же эндпоинт с выбором метода по условию.
   * Но в данном случае лучше использовать createFormData или editFormData в зависимости от ситуации.
   */
  upsertFormData(formSection: string, data: any, isNew: boolean): Observable<any> {
    console.info(`[FormDataService] upsertFormData: isNew = ${isNew}`);
    return isNew
      ? this.createFormData(formSection, data)
      : this.editFormData(formSection, data);
  }
}
