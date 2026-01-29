import { Component, OnInit } from '@angular/core';
import { CallService } from 'src/app/services/call.service';
import { ProfileService } from 'src/app/services/profile.service';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-calls',
  templateUrl: './calls.page.html',
  styleUrls: ['./calls.page.scss'],
  standalone: false
})
export class CallsPage implements OnInit {

  calls: any[] = [];
  myId = localStorage.getItem('user_id');

  constructor(
    private callService: CallService,
    private profileService: ProfileService,
    private alertCtrl: AlertController,
    private toast: ToastController
  ) { }

  ngOnInit() {
    this.loadHistory();
  }

  ionViewWillEnter() {
    this.loadHistory();
  }

  loadHistory(event?: any) {
    this.callService.getCallHistory().subscribe(async (res: any[]) => {
      // Sort by NEWEST first
      res.sort((a, b) => b.created_at - a.created_at);
      this.calls = res;
      await this.resolveNames(this.calls);
      if (event) event.target.complete();
    });
  }

  // Cache names/avatars to avoid flicker
  resolvedProfiles: Map<string, any> = new Map();

  async resolveNames(calls: any[]) {
    const promises = calls.map(async (call) => {
      const otherId = this.getOtherId(call);
      if (!this.resolvedProfiles.has(otherId)) {
        // Fetch profile
        try {
          const profile: any = await this.profileService.getUserProfile(otherId).toPromise();
          if (profile) {
            this.resolvedProfiles.set(otherId, {
              name: `${profile.first_name} ${profile.last_name}`,
              avatar: profile.photo_url
            });
          }
        } catch (e) {
          this.resolvedProfiles.set(otherId, { name: 'Unknown', avatar: '' });
        }
      }
    });

    await Promise.all(promises);
  }

  getOtherId(call: any): string {
    const isCaller = String(call.callerId) === String(this.myId); // Note: Fix 'caller_id' to 'callerId' if schema differs. 
    // Checking previous file view, logic used 'caller_id'. Need to be careful.
    // CallService 'createCall' uses 'callerId'. 'getCallHistory' likely returns what's in Firestore.
    // Let's support both for safety or check schema.
    const cid = call.callerId || call.caller_id;

    if (String(cid) === String(this.myId)) {
      // I am caller, show first participant who isn't me (1:1 assumption for now)
      const parts = call.participants || [];
      return parts.find((p: string) => p !== this.myId) || 'Unknown';
    }
    return cid;
  }

  getDisplayName(call: any): string {
    const id = this.getOtherId(call);
    const p = this.resolvedProfiles.get(id);
    return p ? p.name : 'Loading...';
  }

  getAvatar(call: any): string {
    const id = this.getOtherId(call);
    const p = this.resolvedProfiles.get(id);
    return p ? p.avatar : '';
  }

  getCallIcon(call: any) {
    if (call.type === 'video') return 'videocam';
    return 'call';
  }

  getCallStatusIcon(call: any) {
    const cid = call.callerId || call.caller_id;
    const isCaller = String(cid) === String(this.myId);

    if (isCaller) return 'arrow-forward-outline'; // Outgoing

    // Incoming
    if (call.status === 'missed' || call.status === 'offer') return 'arrow-down-outline'; // Missed
    if (call.status === 'declined') return 'close-circle-outline'; // Declined currently handling as missed/red

    return 'arrow-down-outline'; // Answered incoming?
  }

  getColor(call: any) {
    const cid = call.callerId || call.caller_id;
    const isCaller = String(cid) === String(this.myId);

    if (isCaller) return 'success'; // Green for outgoing

    if (call.status === 'missed' || call.status === 'offer' || call.status === 'declined' || call.status === 'busy') {
      return 'danger'; // Red for missed
    }
    return 'primary'; // Blue for answered incoming
  }

  // --- Actions ---

  async deleteCall(call: any) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Call Log?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.callService.deleteCallLog(call.id).then(() => {
              this.calls = this.calls.filter(c => c.id !== call.id);
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async makeCall(call: any) {
    const otherId = this.getOtherId(call);
    const type = call.type || 'audio';

    // Re-initiate same type of call
    try {
      await this.callService.startGroupCall([otherId], type);
    } catch (e: any) {
      const t = await this.toast.create({ message: e.message || 'Call failed', duration: 2000 });
      t.present();
    }
  }

  doRefresh(event: any) {
    this.loadHistory(event);
  }
}
