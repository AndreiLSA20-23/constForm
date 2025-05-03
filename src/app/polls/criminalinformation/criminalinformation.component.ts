import { Component } from '@angular/core';
import { DformComponent } from '../../display/dform/dform.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-criminalinformation',
  template: `<app-dform componentName="app-criminalinformation"></app-dform>`,
  standalone: true,
  imports: [CommonModule, DformComponent]
})
export class CRIMINALINFORMATIONComponent {

}
