import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NewGroupPageRoutingModule } from './new-group-routing.module';

import { NewGroupPage } from './new-group.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NewGroupPageRoutingModule
  ],
  declarations: [NewGroupPage]
})
export class NewGroupPageModule {}
