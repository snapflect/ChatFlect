import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PushNotifications } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular';
import { ApiService } from './api.service';
import { RelaySyncService } from './relay-sync.service';

@Injectable({
    providedIn: 'root'
})
export class PushService {

    public tapSubject = new BehaviorSubject<string | null>(null);

    // Lazy-loaded to break circular DI: PushService <-> AuthService
    private _auth: any = null;
    private get auth(): any {
        if (!this._auth) {
            const { AuthService } = require('./auth.service');
            this._auth = this.injector.get(AuthService);
        }
        return this._auth;
    }

    private _chat: any = null;
    private get chat(): any {
        if (!this._chat) {
            const { ChatService } = require('./chat.service');
            this._chat = this.injector.get(ChatService);
        }
        return this._chat;
    }

    private _ack: any = null;
    private get ack(): any {
        if (!this._ack) {
            const { MessageAckService } = require('./message-ack.service');
            this._ack = this.injector.get(MessageAckService);
        }
        return this._ack;
    }

    constructor(
        private platform: Platform,
        private api: ApiService,
        private injector: Injector,
        private relaySync: RelaySyncService
    ) { }

    init() {
        if (!this.platform.is('capacitor')) {
            console.log('Push: Not a capacitor platform');
            return;
        }

        // 1. Request Permissions
        PushNotifications.requestPermissions().then(result => {
            if (result.receive === 'granted') {
                PushNotifications.register();
            }
        });

        // 2. Registration Success
        PushNotifications.addListener('registration', (token) => {
            console.log('Push Registration Success', token.value);
            this.registerToken(token.value);
        });

        // 3. Receive Notification (Foreground/Background)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push Received', notification);

            // WAKE SIGNAL LOGIC (Epic 20)
            // We ignore payload content securely.
            // Just trigger a sync.
            const data = notification.data || {};
            if (data.type === 'SYNC') {
                console.log('Push: WAKE SIGNAL RECEIVED -> Triggering Global Sync');

                // HF-2.3C: Trigger WhatsApp-style sync flushes
                this.chat.syncInbox();
                this.ack.flush();

                // Legacy fallback
                this.relaySync.forceSync();
            }
        });

        // 4. Action Performed (Tapped)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push Action', notification);
            // Navigate to app, sync happens on visibility change anyway.
            const data = notification.notification.data;
            if (data && data.chatId) {
                this.tapSubject.next(data.chatId);
            }
        });
    }

    private async registerToken(token: string) {
        const userId = this.auth.getUserId(); // Synchronous check
        if (!userId) return; // Wait for login

        let platformName = 'web';
        if (this.platform.is('android')) platformName = 'android';
        if (this.platform.is('ios')) platformName = 'ios';

        try {
            await this.api.post('push/register.php', {
                token: token,
                platform: platformName
            }).toPromise();
            console.log('Push: Token Registered with Relay Backend');
        } catch (e) {
            console.error('Push: Registration Failed', e);
        }
    }

    // Call this after login manually to ensure sync
    syncToken() {
        if (!this.platform.is('capacitor')) return;

        PushNotifications.checkPermissions().then(async (res) => {
            if (res.receive === 'granted') {
                // Force re-registration logic
                PushNotifications.register();
            }
        });
    }
    // Compatibility properties
    // Compatibility Methods
    initPush() { this.init(); }
    saveToken(token: string) { this.registerToken(token); }

    sendPush(targetId: string, title: string, body: string, data: any) {
        console.log('sendPush shim called:', targetId, title);
        return Promise.resolve();
    }

    clearNotifications() {
        if (this.platform.is('capacitor')) {
            PushNotifications.removeAllDeliveredNotifications();
        }
    }
}
