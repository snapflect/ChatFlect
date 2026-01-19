import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
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
import { GlobalErrorHandler } from './services/global-error-handler';

import { environment } from 'src/environments/environment';
import { initializeApp } from 'firebase/app';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [AppComponent, ReactionPickerComponent, GifPickerComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    CallModalPageModule,
    ForwardModalPageModule,
    DrawingEditorPageModule
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
      initializeApp(environment.firebase);
      console.log('Firebase Initialized Globally');
    } catch (e) {
      console.warn('Firebase already initialized or error', e);
    }
  }
}
