import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ArchivedChatsPageRoutingModule } from './archived-chats-routing.module';

import { ArchivedChatsPage } from './archived-chats.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ArchivedChatsPageRoutingModule,
    SharedModule
  ],
  declarations: [ArchivedChatsPage]
})
export class ArchivedChatsPageModule { }
