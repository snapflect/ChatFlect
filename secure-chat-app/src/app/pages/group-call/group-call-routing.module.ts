import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GroupCallPage } from './group-call.page';

const routes: Routes = [
  {
    path: '',
    component: GroupCallPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GroupCallPageRoutingModule {}
