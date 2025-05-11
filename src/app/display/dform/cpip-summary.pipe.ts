import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cpipSummary',
  standalone: true
})
export class CpipSummaryPipe implements PipeTransform {
  transform(formValue: any): string {
    if (!formValue || typeof formValue !== 'object') {
      return '';
    }

    const keys = Object.keys(formValue);
    const reorderedKeys = keys.slice(0, 6);

    const summaryParts = reorderedKeys.map(key => {
      const value = (formValue[key] !== null && formValue[key] !== undefined && formValue[key] !== '')
        ? formValue[key]
        : '-';
      return `${key}: ${value}`;
    });

    return summaryParts.join(' || ');
  }
}
