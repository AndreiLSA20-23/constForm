import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RequirementsService, IStartData } from '../../services/requirements.service';

@Component({
  selector: 'app-req',
  standalone: true,
  templateUrl: './req.component.html',
  styleUrls: ['./req.component.scss'],
  imports: [CommonModule],
})
export class ReqComponent implements OnInit {
  storage!: IStartData;
  ready = false;
  loading = true;  // Флаг загрузки
  error: string | null = null; // Флаг ошибки

  constructor(private reqSvc: RequirementsService) {}

  ngOnInit(): void {
    this.reqSvc.getStartData().subscribe({
      next: (data) => {
        this.storage = data;
        this.ready = true;
        this.loading = false; // Загрузка завершена
        console.log('[ReqComponent] ✅ Данные успешно загружены', this.storage);
      },
      error: (error) => {
        this.error = 'Error loading data'; // Сообщение об ошибке
        this.loading = false; // Загрузка завершена с ошибкой
        console.error('[ReqComponent] ❌ Ошибка загрузки данных', error);
      }
    });
  }
}
