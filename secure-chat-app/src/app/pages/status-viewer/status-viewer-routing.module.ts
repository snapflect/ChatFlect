import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StatusViewerPage } from './status-viewer.page';

const routes: Routes = [
  {
    path: '',
    component: StatusViewerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StatusViewerPageRoutingModule {}
