import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StatusCreatorPage } from './status-creator.page';

const routes: Routes = [
  {
    path: '',
    component: StatusCreatorPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StatusCreatorPageRoutingModule {}
