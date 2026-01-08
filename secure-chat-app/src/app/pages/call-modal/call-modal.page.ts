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

    ngOnInit() {
        this.status = this.navParams.get('status') || 'calling';
        this.callerName = this.navParams.get('callerName') || 'Contact';

        // Determine type from CallService or NavParams? 
        // Ideally CallService has the current call info regardless.
        if (this.callService.incomingCallData) {
            this.callType = this.callService.incomingCallData.type || 'audio';
        } else {
            // Outgoing
            this.callType = 'audio'; // Default, but should check service or nav params if passed
            // For now, assume we passed it or check activeCallDoc...
            // Ideally pass it in navParams for outgoing too
        }

        // Subscribe to Remote Stream
        this.subRemote = this.callService.remoteStream.subscribe(stream => {
            if (stream) {
                this.remoteStream = stream;
                this.attachRemoteMedia(stream);
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
                this.status = 'connected';
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
