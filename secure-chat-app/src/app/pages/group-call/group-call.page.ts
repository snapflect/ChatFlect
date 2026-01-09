import { Component, OnInit, OnDestroy } from '@angular/core';
import { CallService } from 'src/app/services/call.service';
import { NavController } from '@ionic/angular';
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
    private nav: NavController
  ) { }

  ngOnInit() {
    this.subs.push(
      this.callService.localStream.subscribe(s => this.localStream = s),
      this.callService.remoteStreams.subscribe(map => this.remoteStreams = map),
      this.callService.callStatus.subscribe(status => {
        if (status === 'idle') {
          this.nav.navigateBack('/tabs/chats');
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    // Note: We don't end call on destroy automatically, usually? 
    // Or we do? If user navigates back, we should end.
  }

  toggleMic() {
    this.micEnabled = !this.micEnabled;
    this.callService.toggleAudio(this.micEnabled);
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
    this.nav.back();
  }

  // KeyValue pipe helper
  asArray(map: Map<string, MediaStream>) {
    return Array.from(map.entries());
  }
}
