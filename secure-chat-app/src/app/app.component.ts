import { Component, OnInit } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { CallService } from './services/call.service';
import { ModalController } from '@ionic/angular';
import { CallModalPage } from './pages/call-modal/call-modal.page';
import { PushService } from './services/push.service';
import { PresenceService } from './services/presence.service';
import { App } from '@capacitor/app';
import { NativeBiometric } from 'capacitor-native-biometric';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false
})
export class AppComponent implements OnInit {
  constructor(
    private callService: CallService,
    private modalCtrl: ModalController,
    private pushService: PushService,
    private presence: PresenceService,
    private alertCtrl: AlertController,
    private router: Router
  ) { }

  async ngOnInit() {
    console.log('AppComponent Initialized - Hiding Splash Screen');
    try {
      await SplashScreen.hide();
    } catch (e) {
      console.warn('Splash Screen Hide Error', e);
    }

    this.pushService.initPush();
    this.callService.init();

    // Presence Logic
    this.presence.setPresence('online');

    // Deep Linking (Push)
    this.pushService.messageSubject.subscribe(notification => {
      if (notification && notification.data && notification.data.chatId) {
        const chatId = notification.data.chatId;
        // Use NgZone if coming from outside Angular
        this.router.navigateByUrl(`/chat-detail/${chatId}`);
      }
    });

    App.addListener('appStateChange', async ({ isActive }) => {
      this.presence.setPresence(isActive ? 'online' : 'offline');

      if (isActive) {
        const enabled = localStorage.getItem('biometric_enabled') === 'true';
        if (enabled) {
          await this.performBiometricCheck();
        }
      }
    });

    // Global Call Listener
    this.callService.callStatus.subscribe(async (status) => {
      if (status === 'incoming' || status === 'calling') {
        const callType = (this.callService as any).activeCallType || 'audio';

        const modal = await this.modalCtrl.create({
          component: CallModalPage,
          componentProps: {
            status: status,
            callerName: 'Contact',
            callType: callType
          },
          backdropDismiss: false
        });
        await modal.present();
      }
    });
  }

  async performBiometricCheck() {
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        await NativeBiometric.verifyIdentity({
          reason: "Unlock Secure Chat",
          title: "Security Lock",
          subtitle: "Authentication Required",
          description: "Please verify your identity"
        });
      }
    } catch (e) {
      const alert = await this.alertCtrl.create({
        header: 'Locked',
        message: 'Authentication required to access chats.',
        backdropDismiss: false,
        buttons: [
          {
            text: 'Unlock',
            handler: () => this.performBiometricCheck()
          },
          {
            text: 'Exit',
            role: 'cancel',
            handler: () => App.exitApp()
          }
        ]
      });
      await alert.present();
    }
  }
}
