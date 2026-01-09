import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatDetailPageRoutingModule } from './chat-detail-routing.module';
import { ChatDetailPage } from './chat-detail.page';
import { ImageModalPageModule } from '../image-modal/image-modal.module';
import { FormatTextPipe } from 'src/app/pipes/format-text-pipe';
import { StickerPickerComponent } from 'src/app/components/sticker-picker/sticker-picker.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatDetailPageRoutingModule,
    ImageModalPageModule,
    FormatTextPipe
  ],
  declarations: [ChatDetailPage, StickerPickerComponent]
  // Wait, if FormatTextPipe IS standalone, I should import it. 
  // Let's assume it IS NOT standalone for now, or I'd check the file.
  // Actually, standard ng generate pipe is NOT standalone in older versions, but new ones might be.
  // The error `NG6008: Pipe FormatTextPipe is standalone` confirms it.
  // So I must IMPORT it.
})
export class ChatDetailPageModule { }
