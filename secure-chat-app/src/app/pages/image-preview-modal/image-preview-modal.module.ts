import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ImagePreviewModalPageRoutingModule } from './image-preview-modal-routing.module';

import { ImagePreviewModalPage } from './image-preview-modal.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ImagePreviewModalPageRoutingModule
  ],
  declarations: [ImagePreviewModalPage]
})
export class ImagePreviewModalPageModule {}
