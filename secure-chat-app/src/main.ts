import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

console.log("Starting Angular Bootstrap...");
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
