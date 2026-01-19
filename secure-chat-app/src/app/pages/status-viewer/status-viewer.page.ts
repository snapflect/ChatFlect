import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ModalController, ActionSheetController, ToastController } from '@ionic/angular';
import { StatusService } from 'src/app/services/status.service';
import { ApiService } from 'src/app/services/api.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-status-viewer',
  templateUrl: './status-viewer.page.html',
  styleUrls: ['./status-viewer.page.scss'],
  standalone: false
})
export class StatusViewerPage implements OnInit, OnDestroy {
  @Input() userStatuses: any[] = [];
  @Input() userName: string = '';
  @Input() userAvatar: string = '';
  @Input() isOwnStatus: boolean = false;
  @Input() statusUserId: string = '';

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;

  currentIndex: number = 0;
  progress: number = 0;
  interval: any;
  duration: number = 5000; // 5 seconds per slide
  step: number = 50; // Update every 50ms

  isPaused = false;
  isVideoPlaying = false;

  currentMediaUrl: any = '';
  isLoading = false;
  private currentObjectUrl: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private statusService: StatusService,
    private actionSheetCtrl: ActionSheetController,
    private toast: ToastController,
    private api: ApiService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadMedia(); // Initial load
    this.recordCurrentView();
  }

  ngOnDestroy() {
    this.stopTimer();
    this.stopMedia();
    this.cleanupMedia();
  }

  cleanupMedia() {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.currentMediaUrl = '';
  }

  loadMedia() {
    this.cleanupMedia();
    this.stopTimer();
    this.isPaused = true;
    this.isLoading = true;

    const status = this.currentStatus;

    // Text Status: No media to load
    if (this.isTextStatus) {
      this.isLoading = false;
      this.adjustDurationForMediaType();
      this.startTimer();
      return;
    }

    // Media Status: Fetch Blob
    const url = status.media_url || status.content_url;
    if (!url) {
      this.isLoading = false;
      return; // Broken status
    }

    this.api.getBlob(url).subscribe(blob => {
      if (blob) {
        this.currentObjectUrl = URL.createObjectURL(blob);
        this.currentMediaUrl = this.sanitizer.bypassSecurityTrustUrl(this.currentObjectUrl);

        this.isLoading = false;
        // Delay slightly to allow DOM to render video/img tag
        setTimeout(() => {
          this.isPaused = false;
          this.adjustDurationForMediaType();
          this.playMedia();

          // If it's an image, start timer immediately. 
          // Video/Audio will wait for 'loadedmetadata' or manual play
          if (this.isImageStatus) {
            this.startTimer();
          }
        }, 100);
        this.cdr.detectChanges();
      } else {
        this.isLoading = false;
        this.toast.create({ message: 'Failed to load media', duration: 2000 }).then(t => t.present());
      }
    }, err => {
      this.isLoading = false;
      this.toast.create({ message: 'Error loading media', duration: 2000 }).then(t => t.present());
    });
  }

  // Adjusted accessors
  get currentStatus() {
    return this.userStatuses[this.currentIndex] || {};
  }
  // ... (getters same as before) ...

  get isTextStatus(): boolean {
    return this.currentStatus.type === 'text';
  }

  get isVideoStatus(): boolean {
    return this.currentStatus.type === 'video';
  }

  get isAudioStatus(): boolean {
    return this.currentStatus.type === 'audio';
  }

  get isImageStatus(): boolean {
    return this.currentStatus.type === 'image' || (!this.currentStatus.type && this.currentStatus.media_url);
  }

  adjustDurationForMediaType() {
    if (this.isVideoStatus) {
      this.duration = 30000; // Default max, updated by metadata
    } else if (this.isAudioStatus) {
      this.duration = 30000;
    } else {
      this.duration = 5000;
    }
  }

  onVideoLoaded(event: Event) {
    const video = event.target as HTMLVideoElement;
    if (video.duration && isFinite(video.duration)) {
      this.duration = Math.min(video.duration * 1000, 60000);
      this.restartTimer();
    }
  }

  onAudioLoaded(event: Event) {
    const audio = event.target as HTMLAudioElement;
    if (audio.duration && isFinite(audio.duration)) {
      this.duration = Math.min(audio.duration * 1000, 30000);
      this.restartTimer();
    }
  }

  onVideoEnded() {
    this.next();
  }

  onAudioEnded() {
    this.next();
  }

  startTimer() {
    this.stopTimer();
    if (this.isPaused || this.isLoading) return; // Don't start if loading/paused

    // ... (rest of startTimer Logic)
    this.interval = setInterval(() => {
      if (!this.isPaused && !this.isLoading) {
        this.progress += (this.step / this.duration);
        if (this.progress >= 1) {
          this.next();
        }
      }
    }, this.step);
  }

  restartTimer() {
    this.progress = 0;
    this.startTimer();
  }

  stopTimer() {
    if (this.interval) clearInterval(this.interval);
  }

  playMedia() {
    setTimeout(() => {
      if (this.isVideoStatus && this.videoPlayer?.nativeElement) {
        this.videoPlayer.nativeElement.play().catch(() => { });
      } else if (this.isAudioStatus && this.audioPlayer?.nativeElement) {
        this.audioPlayer.nativeElement.play().catch(() => { });
      }
    }, 100);
  }

  stopMedia() {
    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.pause();
    }
    if (this.audioPlayer?.nativeElement) {
      this.audioPlayer.nativeElement.pause();
    }
  }

  pause() {
    this.isPaused = true;
    this.stopMedia();
  }

  resume() {
    this.isPaused = false;
    this.playMedia();
  }

  recordCurrentView() {
    const currentStatus = this.userStatuses[this.currentIndex];
    if (currentStatus && currentStatus.id) {
      // Fire and forget view recording
      this.statusService.recordView(currentStatus.id).subscribe();
      this.statusService.markAsViewed(currentStatus.id);
    }
  }

  next() {
    this.stopMedia();
    if (this.currentIndex < this.userStatuses.length - 1) {
      this.currentIndex++;
      this.progress = 0;
      this.loadMedia(); // Load new media
      this.recordCurrentView();
    } else {
      this.close();
    }
  }

  prev() {
    this.stopMedia();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.progress = 0;
      this.loadMedia(); // Load new media
    }
  }

  close() {
    this.stopTimer();
    this.stopMedia();
    this.modalCtrl.dismiss();
  }

  async showOptions() {
    this.pause();

    const buttons: any[] = [];

    if (this.isOwnStatus) {
      buttons.push({
        text: 'Delete Status',
        role: 'destructive',
        icon: 'trash',
        handler: () => this.deleteCurrentStatus()
      });
    } else {
      buttons.push({
        text: this.statusService.isUserMuted(this.statusUserId) ? 'Unmute Status' : 'Mute Status',
        icon: 'volume-mute',
        handler: () => this.toggleMute()
      });
    }

    buttons.push({
      text: 'Cancel',
      role: 'cancel',
      handler: () => this.resume()
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Status Options',
      buttons
    });

    await actionSheet.present();
  }

  async deleteCurrentStatus() {
    const currentStatus = this.userStatuses[this.currentIndex];
    if (currentStatus?.id) {
      this.statusService.deleteStatus(currentStatus.id).subscribe({
        next: async () => {
          const t = await this.toast.create({ message: 'Status deleted', duration: 2000 });
          t.present();

          // Remove from array and adjust
          this.userStatuses.splice(this.currentIndex, 1);
          if (this.userStatuses.length === 0) {
            this.close();
          } else if (this.currentIndex >= this.userStatuses.length) {
            this.currentIndex = this.userStatuses.length - 1;
          }
          this.resume();
        },
        error: async () => {
          const t = await this.toast.create({ message: 'Failed to delete', duration: 2000 });
          t.present();
          this.resume();
        }
      });
    }
  }

  async toggleMute() {
    const isMuted = this.statusService.isUserMuted(this.statusUserId);
    this.statusService.muteUser(this.statusUserId, !isMuted).subscribe({
      next: async () => {
        const t = await this.toast.create({
          message: isMuted ? 'Status unmuted' : 'Status muted',
          duration: 2000
        });
        t.present();
        this.resume();
      },
      error: async () => {
        const t = await this.toast.create({ message: 'Action failed', duration: 2000 });
        t.present();
        this.resume();
      }
    });
  }

  getMediaUrl(status: any): string {
    if (!status) return '';
    // Handle both media_url and content_url patterns
    return status.media_url || status.content_url || '';
  }

  // ==================== REACTIONS ====================

  reactions = StatusService.REACTIONS;
  showReactionBar = false;
  myReaction: string | null = null;
  replyText = '';
  showReplyInput = false;

  toggleReactionBar() {
    this.pause();
    this.showReactionBar = !this.showReactionBar;
    this.showReplyInput = false;
  }

  toggleReplyInput() {
    this.pause();
    this.showReplyInput = !this.showReplyInput;
    this.showReactionBar = false;
  }

  sendReaction(reaction: string) {
    const currentStatus = this.userStatuses[this.currentIndex];
    if (!currentStatus?.id) return;

    this.statusService.reactToStatus(currentStatus.id, reaction).subscribe({
      next: async () => {
        this.myReaction = reaction;
        this.showReactionBar = false;
        const t = await this.toast.create({
          message: `Reacted with ${reaction}`,
          duration: 1500,
          position: 'top'
        });
        t.present();
        this.resume();
      },
      error: async () => {
        const t = await this.toast.create({ message: 'Failed to react', duration: 2000 });
        t.present();
        this.resume();
      }
    });
  }

  sendReply() {
    if (!this.replyText.trim()) return;

    const currentStatus = this.userStatuses[this.currentIndex];
    if (!currentStatus?.id) return;

    this.statusService.replyToStatus(currentStatus.id, this.replyText.trim()).subscribe({
      next: async () => {
        const t = await this.toast.create({
          message: 'Reply sent',
          duration: 1500,
          position: 'top'
        });
        t.present();
        this.replyText = '';
        this.showReplyInput = false;
        this.resume();
      },
      error: async () => {
        const t = await this.toast.create({ message: 'Failed to send reply', duration: 2000 });
        t.present();
        this.resume();
      }
    });
  }

  hideOverlays() {
    if (this.showReactionBar || this.showReplyInput) {
      this.showReactionBar = false;
      this.showReplyInput = false;
      this.resume();
    }
  }
}

