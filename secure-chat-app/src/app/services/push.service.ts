import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PushNotifications } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular';
import { ApiService } from './api.service';
import { RelaySyncService } from './relay-sync.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { MessageAckService } from './message-ack.service';

@Injectable({
    providedIn: 'root'
})
export class PushService {

    public tapSubject = new BehaviorSubject<string | null>(null);

    // Lazy-loaded to break circular DI: PushService <-> AuthService
    private _auth: AuthService | null = null;
    private get auth(): AuthService {
        if (!this._auth) {
            // HF-4.4: Circular Dependency handled by lazy Injector.get
            this._auth = this.injector.get(AuthService);
        }
        return this._auth;
    }

    private _chat: ChatService | null = null;
    private get chat(): ChatService {
        if (!this._chat) {
            this._chat = this.injector.get(ChatService);
        }
        return this._chat;
    }

    private _ack: MessageAckService | null = null;
    private get ack(): MessageAckService {
        if (!this._ack) {
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

        // HF-4.5: Periodic Token Refresh (7-day threshold)
        this.checkRotation();

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

            // HF-4.5: Stamp successful sync
            localStorage.setItem('last_push_token_sync', Date.now().toString());
            localStorage.setItem('last_push_token_value', token);

            console.log('Push: Token Registered with Relay Backend');
        } catch (e) {
            console.error('Push: Registration Failed', e);
        }
    }

    private checkRotation() {
        const lastSync = localStorage.getItem('last_push_token_sync');
        if (!lastSync) return;

        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now - parseInt(lastSync, 10) > sevenDaysMs) {
            console.log('Push: Sync threshold (7d) exceeded. Re-registering token...');
            this.syncToken();
        }
    }

    // Call this after login manually to ensure sync
    async syncToken(): Promise<void> {
        if (!this.platform.is('capacitor')) return;

        const res = await PushNotifications.checkPermissions();
        if (res.receive === 'granted') {
            await PushNotifications.register();
        }
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
