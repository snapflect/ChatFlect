import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatDetailPageRoutingModule } from './chat-detail-routing.module';
import { ChatDetailPage } from './chat-detail.page';
import { ImageModalPageModule } from '../image-modal/image-modal.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatDetailPageRoutingModule,
    ImageModalPageModule
  ],
  declarations: [ChatDetailPage]
})
export class ChatDetailPageModule { }
