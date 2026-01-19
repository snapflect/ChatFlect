import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GroupInfoPageRoutingModule } from './group-info-routing.module';

import { GroupInfoPage } from './group-info.page';
import { PickContactModalComponent } from 'src/app/components/pick-contact-modal/pick-contact-modal.component';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GroupInfoPageRoutingModule,
    SharedModule
  ],
  declarations: [GroupInfoPage, PickContactModalComponent]
})
export class GroupInfoPageModule { }
