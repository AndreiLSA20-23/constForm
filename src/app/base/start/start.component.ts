import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RequirementsService, IStartData } from '../../services/requirements.service';

@Component({
  selector: 'app-start',
  standalone: true,
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  imports: [CommonModule],
})
export class StartComponent implements OnInit {
  storage!: IStartData;   // Данные для отображения
  ready = false;          // Флаг, показывающий, что данные загружены
  loading = true;         // Индикатор загрузки данных
  error = '';             // Ошибка при загрузке данных (если будет)

  constructor(private reqSvc: RequirementsService) {}

  ngOnInit(): void {
    // Загружаем данные через сервис, который получает актуальные данные на основе URL
    this.reqSvc.getStartData().subscribe({
      next: (data) => {
        this.storage = data;    // Сохраняем данные в переменную
        this.ready = true;      // Устанавливаем флаг готовности
        this.loading = false;   // Закрываем индикатор загрузки
      },
      error: (error) => {
        this.error = 'Ошибка загрузки данных: ' + error.message;  // Обрабатываем ошибку
        this.loading = false; // Закрываем индикатор загрузки
        console.error('[StartComponent] ❌ Ошибка загрузки данных', error);
      }
    });
  }
}
