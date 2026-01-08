import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfilePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'chats',
    loadChildren: () => import('./pages/chats/chats.module').then(m => m.ChatsPageModule)
  },
  {
    path: 'contacts',
    loadChildren: () => import('./pages/contacts/contacts.module').then(m => m.ContactsPageModule)
  },
  {
    path: 'calls',
    loadChildren: () => import('./pages/calls/calls.module').then(m => m.CallsPageModule)
  },
  {
    path: 'chat-detail/:id',
    loadChildren: () => import('./pages/chat-detail/chat-detail.module').then(m => m.ChatDetailPageModule)
  },
  {
    path: 'new-group',
    loadChildren: () => import('./pages/new-group/new-group.module').then(m => m.NewGroupPageModule)
  },
  {
    path: 'status',
    loadChildren: () => import('./pages/status/status.module').then(m => m.StatusPageModule)
  },
  {
    path: 'status-viewer',
    loadChildren: () => import('./pages/status-viewer/status-viewer.module').then(m => m.StatusViewerPageModule)
  },
  {
    path: 'settings',
    loadChildren: () => import('./pages/settings/settings.module').then(m => m.SettingsPageModule)
  },
  {
    path: 'group-info',
    loadChildren: () => import('./pages/group-info/group-info.module').then(m => m.GroupInfoPageModule)
  },
  {
    path: 'image-preview-modal',
    loadChildren: () => import('./pages/image-preview-modal/image-preview-modal.module').then(m => m.ImagePreviewModalPageModule)
  },
  {
    path: 'status-creator',
    loadChildren: () => import('./pages/status-creator/status-creator.module').then(m => m.StatusCreatorPageModule)
  },
  {
    path: 'backup',
    loadChildren: () => import('./pages/backup/backup.module').then(m => m.BackupPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
