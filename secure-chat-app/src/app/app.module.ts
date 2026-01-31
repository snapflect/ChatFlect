import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { CallModalPageModule } from './pages/call-modal/call-modal.module';
import { ForwardModalPageModule } from './pages/forward-modal/forward-modal.module';
import { DrawingEditorPageModule } from './pages/drawing-editor/drawing-editor.module';

import { ReactionPickerComponent } from './components/reaction-picker/reaction-picker.component';
import { GifPickerComponent } from './components/gif-picker/gif-picker.component';
import { SearchModalPage } from './pages/search-modal/search-modal.page';
import { ViewerHistoryComponent } from './components/viewer-history/viewer-history.component';
import { GlobalErrorHandler } from './services/global-error-handler';

import { environment } from 'src/environments/environment';
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [AppComponent, ReactionPickerComponent, GifPickerComponent, ViewerHistoryComponent],
  imports: [
    BrowserModule,
    CommonModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    CallModalPageModule,
    ForwardModalPageModule,
    DrawingEditorPageModule,
    SearchModalPage
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor() {
    try {
      const app = initializeApp(environment.firebase);
      const db = getFirestore(app);
      enableIndexedDbPersistence(db).catch((err: any) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence failed: multiple tabs open');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence not supported by browser');
        }
      });
      console.log('Firebase Initialized Globally with Persistence');
    } catch (e) {
      console.warn('Firebase already initialized or error', e);
    }
  }
}
