import { Injectable } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ApiService } from './api.service';
import { Platform } from '@ionic/angular';
import { LoggingService } from './logging.service';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { environment } from 'src/environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PushService {
    // VAPID Key from Firebase Console -> Cloud Messaging -> Web Configuration
    // If you don't have one, generate it in Firebase Console.
    // For now, we will try without or user must replace this.
    private readonly VAPID_KEY = ''; // Placeholder: Enter "Web Push Certificate" Key here if needed.

    public messageSubject = new BehaviorSubject<any>(null);

    constructor(
        private api: ApiService,
        private platform: Platform,
        private logger: LoggingService
    ) { }

    initPush() {
        if (this.platform.is('capacitor')) {
            this.initNativePush();
        } else {
            this.initWebPush();
        }
    }

    // --- Native (Android/iOS) ---
    private async initNativePush() {
        try {
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }
            if (permStatus.receive !== 'granted') {
                this.logger.error('Native Push permission denied');
                return;
            }
            await PushNotifications.register();
            this.addNativeListeners();
        } catch (e) {
            this.logger.error('Native Push Init Error', e);
        }
    }

    private cachedToken: string | null = null;

    private addNativeListeners() {
        PushNotifications.addListener('registration', (token: any) => {
            this.logger.log('Native Push Token:', token.value);
            this.cachedToken = token.value;
            this.saveToken(token.value);
        });
        PushNotifications.addListener('registrationError', (err: any) => {
            this.logger.error('Native Push Registration Error:', err.error);
        });
        PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
            this.logger.log('Native Push Received:', notification);
            this.messageSubject.next(notification);
        });
        PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
            this.logger.log('Native Push Action:', notification);
        });
    }

    // --- Web (PWA) ---
    private async initWebPush() {
        try {
            const app = initializeApp(environment.firebase);
            const messaging = getMessaging(app);

            // Request Permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                this.logger.error('Web Notification permission denied');
                return;
            }

            // Get Token
            // validKey is optional in some setups but recommended.
            const options: any = { serviceWorkerRegistration: await navigator.serviceWorker.ready };
            if (this.VAPID_KEY) options.vapidKey = this.VAPID_KEY;

            // Try to register SW if not ready (Hybrid approach)
            // Ideally 'navigator.serviceWorker.register' is done by Angular in main.ts or app.module
            // But we created firebase-messaging-sw.js explicitly.
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    options.serviceWorkerRegistration = registration;
                } catch (err) {
                    this.logger.error("SW Registration Failed", err);
                }
            }

            getToken(messaging, options).then((currentToken) => {
                if (currentToken) {
                    this.logger.log('Web Push Token:', currentToken);
                    this.saveToken(currentToken);
                } else {
                    this.logger.log('No registration token available.');
                }
            }).catch((err) => {
                this.logger.error('An error occurred while retrieving token. ', err);
            });

            // Foreground Messages
            onMessage(messaging, (payload) => {
                this.logger.log('Web Foreground Message:', payload);
                this.messageSubject.next(payload);
                // Optional: Show local notification or toast
            });

        } catch (e) {
            this.logger.error('Web Push Init Error', e);
        }
    }

    async saveToken(token: string) {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            this.logger.log("Push Token received but no user logged in. Cached for later.");
            return;
        }

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

    async syncToken() {
        if (this.cachedToken) {
            this.logger.log("Syncing cached push token...");
            await this.saveToken(this.cachedToken);
        } else {
            // Try to get permission/token again if missing
            this.initPush();
        }
    }

    async sendPush(targetUserId: string, title: string, body: string, data: any = {}) {
        try {
            await this.api.post('push.php', {
                target_user_id: targetUserId,
                title: title,
                body: body,
                data: JSON.stringify(data)
            }).toPromise();
        } catch (e) {
            this.logger.error("Send Push Failed", e);
        }
    }
}
