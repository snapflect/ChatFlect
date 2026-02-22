import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SecurityHistoryPageRoutingModule } from './security-history-routing.module';

import { SecurityHistoryPage } from './security-history.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SecurityHistoryPageRoutingModule,
    SharedModule
  ],
  declarations: [SecurityHistoryPage]
})
export class SecurityHistoryPageModule { }
