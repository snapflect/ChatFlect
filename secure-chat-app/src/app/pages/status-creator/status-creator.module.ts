import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StatusCreatorPageRoutingModule } from './status-creator-routing.module';

import { StatusCreatorPage } from './status-creator.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StatusCreatorPageRoutingModule
  ],
  declarations: [StatusCreatorPage]
})
export class StatusCreatorPageModule {}
