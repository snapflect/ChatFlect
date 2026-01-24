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

  // Active Speaker & Grid State
  audioLevels: Map<string, number> = new Map();
  activeSpeakerId: string | null = null;
  private audioMonitorInterval: any;

  ngOnInit() {
    this.updateCallerInfo();

    // Init Speaker State
    this.speakerEnabled = this.callService.activeCallType === 'video';
    // Attempt to set it in service (might fail if no devices ready yet, but good to try)
    this.callService.toggleSpeaker(this.speakerEnabled);

    this.startAudioMonitor(); // Start monitoring audio levels

    this.subs.push(
      this.callService.localStream.subscribe(s => this.localStream = s),
      this.callService.remoteStreams.subscribe(map => this.remoteStreams = map),
      this.callService.callStatus.subscribe(async (status) => {
        if (status === 'idle') {
          this.stopTimer();
          this.stopAudioMonitor();
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

  // Poll audio levels for active speaker highlighting
  private startAudioMonitor() {
    this.audioMonitorInterval = setInterval(async () => {
      this.callService.remoteStreams.value.forEach(async (stream, peerId) => {
        // Mock level or get from WebRTC Stats if exposed
        // Since getting stats is async and heavy, we might simulating or using a lightweight Web Audio API analyzer if stream available
        // For now, let's assume we maintain a visual "talking" state based on simple AudioContext analysis if possible
        // Implementation of WebAudio analysis:
        const level = await this.getStreamVolume(stream);
        this.audioLevels.set(peerId, level);
      });

      // Determine max
      let maxVol = 0;
      let maxId = null;
      this.audioLevels.forEach((vol, id) => {
        if (vol > 0.1 && vol > maxVol) {
          maxVol = vol;
          maxId = id;
        }
      });
      this.activeSpeakerId = maxId;
    }, 500);
  }

  private stopAudioMonitor() {
    if (this.audioMonitorInterval) clearInterval(this.audioMonitorInterval);
  }

  // Simple Web Audio API volume meter
  private async getStreamVolume(stream: MediaStream): Promise<number> {
    try {
      if (!stream.getAudioTracks().length) return 0;
      const audioContext = new AudioContext(); // Re-use this in production!
      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 32;
      mediaStreamSource.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (const a of dataArray) sum += a;
      await audioContext.close(); // Clean up!
      return sum / dataArray.length / 255; // Normalize 0-1
    } catch (e) {
      return 0;
    }
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
