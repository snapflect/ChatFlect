
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { JoinGroupPage } from './join-group.page';
import { RouterModule } from '@angular/router';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        RouterModule.forChild([{ path: '', component: JoinGroupPage }])
    ],
    declarations: [JoinGroupPage]
})
export class JoinGroupPageModule { }
