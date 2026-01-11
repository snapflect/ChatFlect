import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { CallService } from 'src/app/services/call.service';
import { Subscription } from 'rxjs';
import { LoggingService } from 'src/app/services/logging.service';

@Component({
    selector: 'app-call-modal',
    templateUrl: './call-modal.page.html',
    styleUrls: ['./call-modal.page.scss'],
    standalone: false
})
export class CallModalPage implements OnInit, OnDestroy {
    status: 'calling' | 'incoming' | 'connected' = 'calling';
    callType: 'audio' | 'video' = 'audio';
    remoteStream: MediaStream | null = null;
    localStream: MediaStream | null = null;
    callerName = 'Unknown';

    private subRemote: Subscription | null = null;
    private subLocal: Subscription | null = null;

    constructor(
        private modalCtrl: ModalController,
        private callService: CallService,
        private navParams: NavParams,
        private logger: LoggingService
    ) { }

    get isVideo() { return this.callType === 'video'; }

    callerPhoto = 'assets/avatar-placeholder.png';

    // ...

    async ngOnInit() {
        this.status = this.navParams.get('status') || 'calling';
        // this.callerName = this.navParams.get('callerName') || 'Contact'; // Legacy

        // Determine type and Fetch Caller Info
        if (this.callService.incomingCallData) {
            this.callType = this.callService.incomingCallData.type || 'audio';
            const cid = this.callService.incomingCallData.callerId;
            if (cid) {
                const info = await this.callService.getCallerInfo(cid);
                this.callerName = info.username || 'Unknown';
                if (info.photo) this.callerPhoto = info.photo;
            }
        } else {
            // Outgoing
            this.callType = this.callService.activeCallType || 'audio';
            this.callerName = this.navParams.get('callerName') || 'Unknown';
        }

        // Subscribe to Remote Streams (Map)
        this.subRemote = this.callService.remoteStreams.subscribe(map => {
            if (map && map.size > 0) {
                // For legacy modal (1:1), just take the first stream
                const stream = map.values().next().value;
                if (stream) {
                    this.remoteStream = stream;
                    this.attachRemoteMedia(stream);
                }
            } else {
                this.remoteStream = null;
            }
        });

        // Subscribe to Local Stream (For Video Preview)
        this.subLocal = this.callService.localStream.subscribe(stream => {
            if (stream) {
                this.localStream = stream;
                if (this.isVideo) this.attachLocalMedia(stream);
            }
        });

        // Listen to Status Changes
        this.callService.callStatus.subscribe(s => {
            if (s === 'idle') {
                this.dismiss();
            } else if (s === 'connected') {
                // Determine navigation handled by AppComponent/Parent
                this.dismiss();
            }
        });
    }

    attachRemoteMedia(stream: MediaStream) {
        setTimeout(() => {
            if (this.isVideo) {
                const video = document.getElementById('remoteVideo') as HTMLVideoElement;
                if (video) {
                    video.srcObject = stream;
                    video.play().catch(e => this.logger.error("Remote Video Auto-play failed", e));
                }
            }
            // Always attach Audio (fallback or primary)
            const audio = document.getElementById('remoteAudio') as HTMLAudioElement;
            if (audio) {
                audio.srcObject = stream;
                audio.play().catch(e => this.logger.error("Remote Audio Auto-play failed", e));
            }
        }, 500);
    }

    attachLocalMedia(stream: MediaStream) {
        setTimeout(() => {
            const video = document.getElementById('localVideo') as HTMLVideoElement;
            if (video) {
                video.srcObject = stream;
                video.play().catch(e => this.logger.error("Local Video Auto-play failed", e));
                video.muted = true; // Always mute local
            }
        }, 500);
    }

    answer() {
        this.callService.answerCall();
        this.status = 'connected';
    }

    hangup() {
        this.callService.endCall();
        this.dismiss();
    }

    dismiss() {
        this.modalCtrl.dismiss();
    }

    isMuted = false;
    isVideoEnabled = true;

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.callService.toggleAudio(!this.isMuted);
    }

    toggleVideo() {
        this.isVideoEnabled = !this.isVideoEnabled;
        this.callService.toggleVideo(this.isVideoEnabled);
    }

    flipCamera() {
        this.callService.switchCamera();
    }

    ngOnDestroy() {
        if (this.subRemote) this.subRemote.unsubscribe();
        if (this.subLocal) this.subLocal.unsubscribe();
    }
}
