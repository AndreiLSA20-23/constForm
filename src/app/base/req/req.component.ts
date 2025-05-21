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
  loading = true;  
  error: string | null = null;

  constructor(private reqSvc: RequirementsService) {}

  ngOnInit(): void {
    this.reqSvc.getStartData().subscribe({
      next: (data) => {
        this.storage = data;
        this.ready = true;
        this.loading = false; 
      },
      error: (error) => {
        this.error = 'Error loading data';
        this.loading = false; 
        console.error('[ReqComponent] Loads ERRORS');
      }
    });
  }
}
