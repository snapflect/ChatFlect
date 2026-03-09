import { Component, OnInit, OnDestroy } from '@angular/core';
import { CallService } from './services/call.service';
import { CallModalPage } from './pages/call-modal/call-modal.page';
import { PushService } from './services/push.service';
import { PresenceService } from './services/presence.service';
import { App } from '@capacitor/app';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Platform, AlertController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { SoundService } from './services/sound.service';
import { ChatService } from './services/chat.service';
import { SyncService } from './services/sync.service';
import { SignalStoreService, IdentityMismatchEvent } from './services/signal-store.service';
import { Network } from '@capacitor/network';
import { filter, take } from 'rxjs/operators';
import { AppInitService } from './services/app-init.service';
import { LocalDbService, VaultState } from './services/local-db.service';

import { BehaviorSubject, Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StorageService } from './services/storage.service';
import { AuthService } from './services/auth.service';
import { Injector } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  public isOffline$ = new BehaviorSubject<boolean>(false);
  public bootError$ = this.appInit.bootError$;
  private networkSub: any; // Capacitor Network.addListener returns a Promise<PluginListenerHandle>
  private authSub!: Subscription; // This is not used in the provided snippet, but kept as per instruction
  private appReady = false;
  private appStateListener: any;
  private destroy$ = new Subject<void>();

  private get callService(): CallService { return this.injector.get(CallService); }
  private get pushService(): PushService { return this.injector.get(PushService); }
  private get presence(): PresenceService { return this.injector.get(PresenceService); }
  private get soundService(): SoundService { return this.injector.get(SoundService); }
  private get chatService(): ChatService { return this.injector.get(ChatService); }
  private get syncService(): SyncService { return this.injector.get(SyncService); }
  private get signalStore(): SignalStoreService { return this.injector.get(SignalStoreService); }
  private get auth(): AuthService { return this.injector.get(AuthService); }
  private get localDb(): LocalDbService { return this.injector.get(LocalDbService); }

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private router: Router,
    private appInit: AppInitService,
    private platform: Platform,
    private storage: StorageService,
    private injector: Injector
  ) {
  }

  async ngOnInit() {
    // Phase 4: Network Monitor
    if (this.platform.is('capacitor')) {
      this.networkSub = await Network.addListener('networkStatusChange', status => {
        console.log('[AppComponent] Network status changed:', status.connected);
        this.isOffline$.next(!status.connected);
      });
      const status = await Network.getStatus();
      this.isOffline$.next(!status.connected);
    }

    this.appInit.bootState$.pipe(
      filter(s => s === 'BOOT_COMPLETE'),
      take(1)
    ).subscribe(() => {
      this.finishInit();
    });

    this.appStateListener = await App.addListener('appStateChange', async (state: { isActive: boolean }) => {
      const { isActive } = state;
      this.presence.setPresence(isActive ? 'online' : 'offline');

      if (isActive) {
        console.log(`[Lifecycle] Resume - Vault:${this.localDb.vaultState.value === VaultState.READY}`);

        const enabled = localStorage.getItem('biometric_enabled') === 'true';
        if (enabled && this.localDb.vaultState.value !== VaultState.READY) {
          await this.performBiometricCheck();
        }

        // HF-Resume: Resume sync services safely
        try {
          await this.syncService.start();
        } catch (e) {
          console.error('[Lifecycle] Error resuming sync service', e);
        }

        // Refresh auth token gracefully on resume
        this.auth.checkTokenExpiry();
      }
    });
  }

  private finishInit() {
    if (this.appReady) {
      console.log('[AppComponent] finishInit already executed. Skipping.');
      return;
    }
    this.appReady = true;

    // Presence Logic
    this.presence.setPresence('online');

    // Push Notification Messages (deep link on tap)
    this.pushService.tapSubject.pipe(takeUntil(this.destroy$)).subscribe((chatId: string | null) => {
      if (chatId) {
        this.router.navigateByUrl(`/chat-detail/${chatId}`);
      }
    });

    // Real-time Message Sound
    this.chatService.newMessage$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      // Possible sound logic
    });

    // Story 6.2: Global Identity Mismatch Alert
    this.signalStore.identityMismatch$.pipe(takeUntil(this.destroy$)).subscribe((event: IdentityMismatchEvent) => {
      this.showIdentityMismatchAlert(event);
    });

    // Global Call Listener
    this.callService.callStatus.pipe(takeUntil(this.destroy$)).subscribe(async (status: string) => {
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
        this.router.navigate(['/group-call']);
      }
    });
  }

  // Story 6.2: Identity Mismatch Alert Handler
  private async showIdentityMismatchAlert(event: IdentityMismatchEvent) {
    const alert = await this.alertCtrl.create({
      header: 'Security Code Changed',
      subHeader: `Contact: ${event.identifier}`,
      message: `The security code for this contact has changed. This could mean they reinstalled the app, or it could indicate a security issue. Do you want to trust this new identity?`,
      backdropDismiss: false,
      cssClass: 'security-alert',
      buttons: [
        {
          text: 'Block Permanently',
          role: 'cancel',
          cssClass: 'danger',
          handler: async () => {
            console.log('User blocking identity for', event.identifier);
            // STRICT FIX: Mark identity as permanently blocked
            await this.signalStore.markIdentityBlocked(event.identifier);
            this.signalStore.clearMismatchAlert(event.identifier);
          }
        },
        {
          text: 'Trust New Key',
          handler: async () => {
            console.log('User trusting new key for', event.identifier);
            await this.signalStore.forceTrustIdentity(event.identifier, event.newKey);
            this.signalStore.clearMismatchAlert(event.identifier);
          }
        }
      ]
    });

    await alert.present();
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
    } catch {
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

  async retryBoot() {
    await this.appInit.retry();
  }

  async resetAndReload() {
    const alert = await this.alertCtrl.create({
      header: 'Reset All Data?',
      message: 'This will wipe all local messages and encryption keys. You will need to log in again. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset Everything',
          role: 'destructive',
          handler: () => {
            this.localDb.triggerNuke();
          }
        }
      ]
    });
    await alert.present();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.networkSub) {
      this.networkSub.remove();
    }

    if (this.appStateListener) {
      this.appStateListener.remove();
    }
  }
}
