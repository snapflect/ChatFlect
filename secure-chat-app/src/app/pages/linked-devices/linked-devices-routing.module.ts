import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LinkedDevicesPage } from './linked-devices.page';

const routes: Routes = [
  {
    path: '',
    component: LinkedDevicesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LinkedDevicesPageRoutingModule {}
