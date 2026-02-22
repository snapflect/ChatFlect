import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SecurityHistoryPage } from './security-history.page';

const routes: Routes = [
  {
    path: '',
    component: SecurityHistoryPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SecurityHistoryPageRoutingModule {}
