import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ForwardModalPage } from './forward-modal.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule
    ],
    declarations: [ForwardModalPage],
    exports: [ForwardModalPage]
})
export class ForwardModalPageModule { }
