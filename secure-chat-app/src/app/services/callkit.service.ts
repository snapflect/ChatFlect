import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { CallKitVoip, CallData, CallToken } from 'capacitor-plugin-callkit-voip';
import { LoggingService } from './logging.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CallKitService {

    public voipToken = new BehaviorSubject<string | null>(null);
    public lastCallAction = new BehaviorSubject<{ type: 'answered' | 'started' | 'ended', data: CallData } | null>(null);

    constructor(
        private platform: Platform,
        private logger: LoggingService
    ) { }

    async init() {
        if (!this.platform.is('capacitor')) return;

        try {
            this.logger.log("[CallKit] Registering...");
            await CallKitVoip.register();
            this.logger.log("[CallKit] Registered");

            // Listeners
            CallKitVoip.addListener('registration', (token: CallToken) => {
                this.logger.log("[CallKit] VoIP Token:", token.value);
                this.voipToken.next(token.value);
                // Note: You should sync this token to your backend in 'ProfileService' similar to FCM
            });

            CallKitVoip.addListener('callAnswered', (data: CallData) => {
                this.logger.log("[CallKit] Answered:", data);
                this.lastCallAction.next({ type: 'answered', data });
            });

            CallKitVoip.addListener('callStarted', (data: CallData) => {
                this.logger.log("[CallKit] Started:", data);
                this.lastCallAction.next({ type: 'started', data });
            });

            CallKitVoip.addListener('callEnded', (data: CallData) => {
                this.logger.log("[CallKit] Ended:", data);
                this.lastCallAction.next({ type: 'ended', data });
            });

        } catch (e) {
            this.logger.error("[CallKit] Init Failed", e);
        }
    }
}
