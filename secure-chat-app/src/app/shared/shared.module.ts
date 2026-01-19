import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LongPressDirective } from '../directives/long-press.directive';

import { SecureSrcDirective } from '../directives/secure-src.directive';

@NgModule({
    declarations: [LongPressDirective, SecureSrcDirective],
    imports: [CommonModule],
    exports: [LongPressDirective, SecureSrcDirective]
})
export class SharedModule { }
