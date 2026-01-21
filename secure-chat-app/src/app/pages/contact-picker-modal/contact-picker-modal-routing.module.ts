import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ContactPickerModalPage } from './contact-picker-modal.page';

const routes: Routes = [
  {
    path: '',
    component: ContactPickerModalPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContactPickerModalPageRoutingModule {}
