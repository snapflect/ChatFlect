import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ImageModalPage } from './image-modal.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        SharedModule
    ],
    declarations: [ImageModalPage],
    exports: [ImageModalPage] // Export so it can be used if imported
})
export class ImageModalPageModule { }
