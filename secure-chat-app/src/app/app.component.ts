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
import { SoundService } from './services/sound.service';
import { ChatService } from './services/chat.service';
import { SyncService } from './services/sync.service';

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
    private router: Router,
    private soundService: SoundService,
    private chatService: ChatService,
    private syncService: SyncService // Init Sync Listener
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

    // Push Notification Messages (deep link on tap)
    // Push Notification Messages (deep link on tap)
    this.pushService.tapSubject.subscribe(chatId => {
      if (chatId) {
        // Deep link when user taps notification
        this.router.navigateByUrl(`/chat-detail/${chatId}`);
      }
    });

    // Real-time Message Sound (from Firestore listener)
    this.chatService.newMessage$.subscribe(msg => {
      // SoundService checks if user is already in this chat
      // Temporarily disabled to debug crash
      // this.soundService.playMessageSound(msg.chatId);
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

    // Global Call Listener - Only show modal for INCOMING calls
    // Outgoing calls navigate directly to /group-call page (handled by chat-detail.page.ts)
    this.callService.callStatus.subscribe(async (status) => {
      if (status === 'incoming') {
        const callType = this.callService.activeCallType || 'audio';
        const isGroup = this.callService.isGroupCall;

        const modal = await this.modalCtrl.create({
          component: CallModalPage,
          componentProps: {
            status: status,
            callerName: isGroup ? 'Group Call' : 'Contact',
            callType: callType
          },
          backdropDismiss: false
        });
        await modal.present();
      } else if (status === 'connected') {
        // Ensure we navigate to the main call screen
        this.router.navigate(['/group-call']);
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
