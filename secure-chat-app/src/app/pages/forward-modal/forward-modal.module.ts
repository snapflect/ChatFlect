import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ForwardModalPage } from './forward-modal.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        SharedModule
    ],
    declarations: [ForwardModalPage],
    exports: [ForwardModalPage]
})
export class ForwardModalPageModule { }
