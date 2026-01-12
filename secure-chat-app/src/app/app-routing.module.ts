import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { AutoLoginGuard } from './guards/auto-login.guard';
import { ProfileCompletionGuard } from './guards/profile-completion.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule),
    canActivate: [AutoLoginGuard]
  },
  {
    path: 'profile',
    loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfilePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [AuthGuard, ProfileCompletionGuard]
  },
  {
    path: 'chats',
    loadChildren: () => import('./pages/chats/chats.module').then(m => m.ChatsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'contacts',
    loadChildren: () => import('./pages/contacts/contacts.module').then(m => m.ContactsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'calls',
    loadChildren: () => import('./pages/calls/calls.module').then(m => m.CallsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'chat-detail/:id',
    loadChildren: () => import('./pages/chat-detail/chat-detail.module').then(m => m.ChatDetailPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'new-group',
    loadChildren: () => import('./pages/new-group/new-group.module').then(m => m.NewGroupPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'status',
    loadChildren: () => import('./pages/status/status.module').then(m => m.StatusPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'status-viewer',
    loadChildren: () => import('./pages/status-viewer/status-viewer.module').then(m => m.StatusViewerPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'settings',
    loadChildren: () => import('./pages/settings/settings.module').then(m => m.SettingsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'group-info/:id',
    loadChildren: () => import('./pages/group-info/group-info.module').then(m => m.GroupInfoPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'image-preview-modal',
    loadChildren: () => import('./pages/image-preview-modal/image-preview-modal.module').then(m => m.ImagePreviewModalPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'status-creator',
    loadChildren: () => import('./pages/status-creator/status-creator.module').then(m => m.StatusCreatorPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'backup',
    loadChildren: () => import('./pages/backup/backup.module').then(m => m.BackupPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'group-call',
    loadChildren: () => import('./pages/group-call/group-call.module').then(m => m.GroupCallPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'live-map',
    loadChildren: () => import('./pages/live-map/live-map.module').then(m => m.LiveMapPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'archived-chats',
    loadChildren: () => import('./pages/archived-chats/archived-chats.module').then(m => m.ArchivedChatsPageModule)
  },
  {
    path: 'starred-messages',
    loadChildren: () => import('./pages/starred-messages/starred-messages.module').then(m => m.StarredMessagesPageModule),
    canActivate: [AuthGuard]
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
