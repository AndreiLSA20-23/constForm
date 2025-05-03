import { Component } from '@angular/core';
import { DformComponent } from '../../display/dform/dform.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drivingexperience',
  template: `<app-dform componentName="app-drivingexperience"></app-dform>`,
  standalone: true,
  imports: [CommonModule, DformComponent]
})
export class DRIVINGEXPERIENCEComponent {

}
