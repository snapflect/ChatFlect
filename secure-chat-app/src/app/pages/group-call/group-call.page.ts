import { Component, OnInit, OnDestroy } from '@angular/core';
import { CallService } from 'src/app/services/call.service';
import { NavController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-group-call',
  templateUrl: './group-call.page.html',
  styleUrls: ['./group-call.page.scss'],
  standalone: false
})
export class GroupCallPage implements OnInit, OnDestroy {
  localStream: MediaStream | null = null;
  remoteStreams: Map<string, MediaStream> = new Map();

  micEnabled = true;
  videoEnabled = true;

  private subs: Subscription[] = [];

  constructor(
    public callService: CallService,
    private nav: NavController,
    private toastCtrl: ToastController
  ) { }

  callDuration = '00:00';
  private timerInterval: any;
  private startTime: number = 0;

  callerName = 'Unknown';
  callerPhoto = 'assets/avatar-placeholder.png';

  speakerEnabled = false; // Default false (earpiece) for audio, true for video

  ngOnInit() {
    this.updateCallerInfo();

    // Init Speaker State
    this.speakerEnabled = this.callService.activeCallType === 'video';
    // Attempt to set it in service (might fail if no devices ready yet, but good to try)
    this.callService.toggleSpeaker(this.speakerEnabled);

    this.subs.push(
      this.callService.localStream.subscribe(s => this.localStream = s),
      this.callService.remoteStreams.subscribe(map => this.remoteStreams = map),
      this.callService.callStatus.subscribe(async (status) => {
        if (status === 'idle') {
          this.stopTimer();
          this.nav.back();
        } else if (status === 'connected') {
          this.startTimer();
        } else if (status === 'declined') {
          await this.showToast('Call was declined');
        } else if (status === 'busy') {
          await this.showToast('User is busy');
        }
      })
    );
  }

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  ngOnDestroy() {
    this.stopTimer();
    this.subs.forEach(s => s.unsubscribe());
  }

  private startTimer() {
    if (this.timerInterval) return;
    this.startTime = this.callService.callStartTime || Date.now();
    this.timerInterval = setInterval(() => {
      const distinct = Date.now() - this.startTime;
      const seconds = Math.floor((distinct / 1000) % 60);
      const minutes = Math.floor((distinct / (1000 * 60)) % 60);
      const hours = Math.floor((distinct / (1000 * 60 * 60)) % 24);

      const hrStr = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : '';
      this.callDuration = `${hrStr}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.callDuration = '00:00';
  }

  toggleMic() {
    this.micEnabled = !this.micEnabled;
    this.callService.toggleAudio(this.micEnabled);
  }

  toggleSpeaker() {
    this.speakerEnabled = !this.speakerEnabled;
    this.callService.toggleSpeaker(this.speakerEnabled);
  }

  toggleHold() {
    const current = this.callService.isOnHold.value;
    this.callService.toggleHold(!current);
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    this.callService.toggleVideo(this.videoEnabled);
  }

  switchCamera() {
    this.callService.switchCamera();
  }

  endCall() {
    this.callService.endCall();
    // Navigation is handled by callStatus subscription ('idle' -> nav.back())
  }

  private async updateCallerInfo() {
    let userIdToFetch = null;

    if (this.callService.incomingCallData?.callerId) {
      userIdToFetch = this.callService.incomingCallData.callerId;
    } else if (this.callService.isOutgoingCall && this.callService.otherPeerId) {
      userIdToFetch = this.callService.otherPeerId;
    }

    if (userIdToFetch) {
      const info = await this.callService.getCallerInfo(userIdToFetch);
      this.callerName = info.username;
      if (info.photo) this.callerPhoto = info.photo;
    }
  }

  // KeyValue pipe helper
  asArray(map: Map<string, MediaStream>) {
    return Array.from(map.entries());
  }

  // Prevent flickering by tracking peer ID
  trackByPeerId(index: number, item: [string, MediaStream]) {
    return item[0];
  }
}
