import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LiveMapPageRoutingModule } from './live-map-routing.module';

import { LiveMapPage } from './live-map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LiveMapPageRoutingModule
  ],
  declarations: [LiveMapPage]
})
export class LiveMapPageModule {}
