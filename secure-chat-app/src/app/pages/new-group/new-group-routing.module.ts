import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NewGroupPage } from './new-group.page';

const routes: Routes = [
  {
    path: '',
    component: NewGroupPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NewGroupPageRoutingModule {}
