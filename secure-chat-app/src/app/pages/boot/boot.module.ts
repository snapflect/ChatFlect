import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BootPage } from './boot.page';
import { RouterModule } from '@angular/router';

@NgModule({
    imports: [
        CommonModule,
        IonicModule,
        RouterModule.forChild([{ path: '', component: BootPage }])
    ],
    declarations: [BootPage]
})
export class BootPageModule { }
