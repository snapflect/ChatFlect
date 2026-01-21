import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { LongPressDirective } from '../directives/long-press.directive';
import { SecureSrcDirective } from '../directives/secure-src.directive';
import { AudioWaveformComponent } from './audio-waveform/audio-waveform.component';

@NgModule({
    declarations: [LongPressDirective, SecureSrcDirective, AudioWaveformComponent],
    imports: [CommonModule, IonicModule],
    exports: [LongPressDirective, SecureSrcDirective, AudioWaveformComponent]
})
export class SharedModule { }

