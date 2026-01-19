import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DrawingEditorPage } from './drawing-editor.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule
    ],
    declarations: [DrawingEditorPage],
    exports: [DrawingEditorPage]
})
export class DrawingEditorPageModule { }
