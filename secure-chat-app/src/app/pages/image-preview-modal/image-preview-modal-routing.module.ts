import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ImagePreviewModalPage } from './image-preview-modal.page';

const routes: Routes = [
  {
    path: '',
    component: ImagePreviewModalPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ImagePreviewModalPageRoutingModule {}
