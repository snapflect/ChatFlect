import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LiveMapPage } from './live-map.page';

const routes: Routes = [
  {
    path: '',
    component: LiveMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LiveMapPageRoutingModule {}
