import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LinkedDevicesPageRoutingModule } from './linked-devices-routing.module';

import { LinkedDevicesPage } from './linked-devices.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LinkedDevicesPageRoutingModule
  ],
  declarations: [LinkedDevicesPage]
})
export class LinkedDevicesPageModule {}
