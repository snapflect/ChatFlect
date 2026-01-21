import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ContactPickerModalPageRoutingModule } from './contact-picker-modal-routing.module';

import { ContactPickerModalPage } from './contact-picker-modal.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContactPickerModalPageRoutingModule,
    SharedModule
  ],
  declarations: [ContactPickerModalPage]
})
export class ContactPickerModalPageModule { }
