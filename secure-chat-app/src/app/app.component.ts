import { Component, OnInit } from '@angular/core';
import { CallService } from './services/call.service';
import { ModalController } from '@ionic/angular';
import { CallModalPage } from './pages/call-modal/call-modal.page';
import { PushService } from './services/push.service';
import { PresenceService } from './services/presence.service';
import { App } from '@capacitor/app';

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
    private presence: PresenceService
  ) { }

  async ngOnInit() {
    this.pushService.initPush();
    this.callService.init();

    // Presence Logic
    this.presence.setPresence('online');

    App.addListener('appStateChange', ({ isActive }) => {
      this.presence.setPresence(isActive ? 'online' : 'offline');
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
}
