import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GroupCallPageRoutingModule } from './group-call-routing.module';

import { GroupCallPage } from './group-call.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GroupCallPageRoutingModule,
    SharedModule
  ],
  declarations: [GroupCallPage]
})
export class GroupCallPageModule { }
