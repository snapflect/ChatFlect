import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ArchivedChatsPage } from './archived-chats.page';

const routes: Routes = [
  {
    path: '',
    component: ArchivedChatsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArchivedChatsPageRoutingModule {}
