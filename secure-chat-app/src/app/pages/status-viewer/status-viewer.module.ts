import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StatusViewerPageRoutingModule } from './status-viewer-routing.module';

import { StatusViewerPage } from './status-viewer.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StatusViewerPageRoutingModule,
    SharedModule
  ],
  declarations: [StatusViewerPage]
})
export class StatusViewerPageModule { }
