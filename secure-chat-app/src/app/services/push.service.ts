import { Injectable } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ApiService } from './api.service';
import { Platform } from '@ionic/angular';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class PushService {

    constructor(
        private api: ApiService,
        private platform: Platform,
        private logger: LoggingService
    ) { }

    initPush() {
        if (!this.platform.is('capacitor')) {
            this.logger.log('Push Notifications not supported on web/PWA yet.');
            return;
        }

        this.register();
        this.addListeners();
    }

    public async register() {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            this.logger.error('Push permission denied');
            return;
        }

        await PushNotifications.register();
    }

    private addListeners() {
        PushNotifications.addListener('registration', token => {
            this.logger.log('Push Registration Success:', token.value);
            this.saveToken(token.value);
        });

        PushNotifications.addListener('registrationError', err => {
            this.logger.error('Push Registration Error:', err.error);
        });

        PushNotifications.addListener('pushNotificationReceived', notification => {
            this.logger.log('Push Received:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', notification => {
            this.logger.log('Push Action Performed:', notification);
        });
    }

    async saveToken(token: string) {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;

        try {
            await this.api.post('register.php', {
                action: 'update_token',
                user_id: userId,
                fcm_token: token
            }).toPromise();
            this.logger.log('FCM Token Saved to Backend');
        } catch (e) {
            this.logger.error('Failed to save FCM token', e);
        }
    }
}
