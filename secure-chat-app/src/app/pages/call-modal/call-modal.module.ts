import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { CallModalPage } from './call-modal.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule
    ],
    declarations: [CallModalPage],
    exports: [CallModalPage] // Export so it can be used if imported elsewhere
})
export class CallModalPageModule { }
