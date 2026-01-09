import { Component, OnInit } from '@angular/core';
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
        const type = this.callService.incomingCallData?.type || 'audio'; // Default/Fallback
        // Ideally for 'calling' (outgoing), we know the type from startCall, but AppComponent relies on Service state.
        // We should expose callType in Service or store it there.
        // For now, let's assume incomingCallData is populated for incoming.
        // For outgoing, we need to know what we started.

        // Better: CallService exposes `activeCallType`
        // Or check activeCallDoc if possible? 
        // Simpler: The Service knows the type because it started it.
        // Let's rely on incomingCallData or a new field.

        // Actually, I'll update CallService to hold `activeCallType` public property.
        // But for now, let's just default to 'audio' and fix `makeCall` later to pass it properly?
        // No, let's fix CallService first or hack it here?
        // Hack: If incoming, use incomingData. If outgoing, how do we know?
        // `CallService.startCall` was called with type.
        // Let's add `activeCallType` to `CallService` quickly? 
        // Or just inspect `incomingCallData` (which is null for outgoing caller usually until they get answer?)

        // Wait, `incomingCallData` is ONLY for Callee.
        // Caller needs to know their own type.
        // I will use `this.callService.activeCallType` (need to add it) BUT 
        // since I can't edit Service and AppComp in one go, I'll pass a placeholder or try to read it from where?
        // Let's just fix CallService to be robust. 

        // I'll add `public activeCallType` to CallService next.
        // For this edit, I'll try to read it assuming it exists or default 'audio'.

        const callType = (this.callService as any).activeCallType || 'audio';

        const modal = await this.modalCtrl.create({
          component: CallModalPage,
          componentProps: {
            status: status,
            callerName: 'Contact', // Improve: Fetch name logic
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
        // Success
      }
    } catch (e) {
      // Failed or Cancelled - Force Retry or Exit
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
