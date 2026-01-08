import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { HttpClientModule } from '@angular/common/http';

import { CallModalPageModule } from './pages/call-modal/call-modal.module';
import { ForwardModalPageModule } from './pages/forward-modal/forward-modal.module';

import { ReactionPickerComponent } from './components/reaction-picker/reaction-picker.component';
import { GlobalErrorHandler } from './services/global-error-handler';

@NgModule({
  declarations: [AppComponent, ReactionPickerComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    CallModalPageModule,
    ForwardModalPageModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
