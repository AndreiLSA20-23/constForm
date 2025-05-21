import { Component } from '@angular/core';
import { DformComponent } from '../../display/dform/dform.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hazardous',
  template: `<app-dform componentName="app-hazardous"></app-dform>`,
  standalone: true,
  imports: [CommonModule, DformComponent]
})
export class HAZARDOUSComponent {

}
