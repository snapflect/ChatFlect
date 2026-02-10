import { Injectable } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { RelaySyncService } from './relay-sync.service';

@Injectable({
    providedIn: 'root'
})
export class PushService {

    constructor(
        private platform: Platform,
        private api: ApiService,
        private auth: AuthService,
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
                console.log('Push: WAKE SIGNAL RECEIVED -> Triggering Sync');
                // We don't know chatId from payload per security, 
                // so we rely on RelaySyncService to poll ALL active chats or specific logic.
                // For MVP, RelaySyncService usually polls active chat.
                // Ideally, we trigger a global check.
                // Assuming RelaySyncService has a global poll or we iterate.

                // For now, let's trigger the sync if a chat is active.
                this.relaySync.forceSync();
            }
        });

        // 4. Action Performed (Tapped)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push Action', notification);
            // Navigate to app, sync happens on visibility change anyway.
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
}
