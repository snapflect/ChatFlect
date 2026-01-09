import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GroupCallPageRoutingModule } from './group-call-routing.module';

import { GroupCallPage } from './group-call.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GroupCallPageRoutingModule
  ],
  declarations: [GroupCallPage]
})
export class GroupCallPageModule {}
