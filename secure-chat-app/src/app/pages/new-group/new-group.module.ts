import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NewGroupPageRoutingModule } from './new-group-routing.module';

import { NewGroupPage } from './new-group.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NewGroupPageRoutingModule,
    SharedModule
  ],
  declarations: [NewGroupPage]
})
export class NewGroupPageModule { }
