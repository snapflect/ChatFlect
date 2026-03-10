import { Component, OnInit } from '@angular/core';
import { StatusService } from 'src/app/services/status.service';
import { ModalController, ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { StatusViewerPage } from '../status-viewer/status-viewer.page';
import { ProfileService } from 'src/app/services/profile.service';
import { App } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';

interface StatusUser {
  user_id: string;
  name: string;
  avatar: string;
  updates: any[];
  view_count?: number;
  is_muted?: boolean;
}

@Component({
  selector: 'app-status',
  templateUrl: './status.page.html',
  styleUrls: ['./status.page.scss'],
  standalone: false
})
export class StatusPage implements OnInit {
  myStatus: StatusUser | null = null;
  recentUpdates: StatusUser[] = [];
  viewedUpdates: StatusUser[] = [];
  mutedUpdates: StatusUser[] = [];
  myProfilePic: string | null = null;
  myUserId: string = '';
  private resumeSub: PluginListenerHandle | null = null;

  constructor(
    private statusService: StatusService,
    private profileService: ProfileService,
    private modalCtrl: ModalController,
    private toast: ToastController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController
  ) { }

  async ionViewWillEnter() {
    this.myUserId = localStorage.getItem('user_id') || '';
    this.loadProfile();
    this.statusService.refreshFeed(); // Load immediately handling TTL

    this.resumeSub = await App.addListener('resume', () => {
      this.statusService.refreshFeed();
    });
  }

  ngOnInit() {
    this.statusService.statuses$.subscribe((rawFeed: any[]) => {
      this.processFeed(rawFeed);
    });
  }

  ionViewWillLeave() {
    if (this.resumeSub) {
      this.resumeSub.remove();
    }
  }

  async loadProfile() {
    const p: any = await this.profileService.getProfile();
    if (p) {
      this.myProfilePic = p.photo_url;
    }
  }


  doRefresh(event: any) {
    this.statusService.refreshFeed();
    // Timeout for UI spinner
    setTimeout(() => event.target.complete(), 2000);
  }

  /**
   * Generates a Conic Gradient string for segmented status rings.
   * Green for recent, Grey for viewed through.
   */
  getRingStyle(status: StatusUser): string {
    const total = status.updates.length;
    if (total === 0) return 'none';

    const viewedCount = status.updates.filter(u => this.statusService.isViewed(u.id)).length;
    const isAllViewed = viewedCount === total;

    // Colors
    const colorRecent = '#25D366'; // WhatsApp Green
    const colorViewed = '#8e8e93'; // System Grey
    const gapDegree = 3; // Gap between segments

    // Simple cases
    if (total === 1) {
      return isAllViewed
        ? `conic-gradient(${colorViewed} 0deg 360deg)`
        : `conic-gradient(${colorRecent} 0deg 360deg)`;
    }

    let gradient = 'conic-gradient(';
    const segmentSize = 360 / total;

    for (let i = 0; i < total; i++) {
      const start = i * segmentSize + (gapDegree / 2);
      const end = (i + 1) * segmentSize - (gapDegree / 2);

      // Determine color for this segment
      // Logic: Segments are ordered chronological. 
      // If i < viewedCount, it's viewed.
      const color = (i < viewedCount) ? colorViewed : colorRecent;

      gradient += `${color} ${start}deg ${end}deg`;
      if (i < total - 1) gradient += ', ';
    }

    gradient += ')';
    return gradient;
  }

  processFeed(res: any[]) {
    if (!res) return;
    // Group by user
    const usersMap = new Map<string, StatusUser>();

    res.forEach((item: any) => {
      if (!usersMap.has(item.user_id)) {
        usersMap.set(item.user_id, {
          user_id: item.user_id,
          name: item.user_id === this.myUserId ? 'My Status' : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown',
          avatar: item.user_photo,
          updates: [],
          view_count: 0
        } as any);
      }

      const user = usersMap.get(item.user_id)!;
      user.updates.push({
        id: item.id,
        type: item.type,
        media_url: item.media_url,
        text_content: item.text_content,
        background_color: item.background_color,
        font: item.font,
        caption: item.caption,
        created_at: item.created_at,
        view_count: item.view_count
      });

      // Enterprise: Max view view aggregation instead of sum
      if (item.view_count > (user.view_count || 0)) {
        user.view_count = item.view_count;
      }

      // Dynamic property for sorting
      if (item.created_at > (user as any).timestamp) {
        (user as any).timestamp = item.created_at;
      }
    });

    const allUsers = Array.from(usersMap.values());

    // Separate Mine vs Others
    this.myStatus = allUsers.find(u => u.user_id === this.myUserId) || null;
    const others = allUsers.filter(u => u.user_id !== this.myUserId);

    // Sort others by latest timestamp
    others.sort((a, b) => new Date((b as any).timestamp || 0).getTime() - new Date((a as any).timestamp || 0).getTime());

    // Segregate Muted users
    this.mutedUpdates = others.filter(u => this.statusService.isUserMuted(u.user_id));
    const activeOthers = others.filter(u => !this.statusService.isUserMuted(u.user_id));

    this.recentUpdates = activeOthers.filter(u => this.hasUnviewedUpdates(u));
    this.viewedUpdates = activeOthers.filter(u => !this.hasUnviewedUpdates(u));

    // Trigger silent background prefetching of next few statuses
    this.statusService.prefetchFeedMedia(this.recentUpdates);
  }

  loadStatus() {
    this.statusService.refreshFeed();
  }

  async uploadStatus(event: any) {
    let file = event.target.files[0];
    if (file) {
      const mime = file.type;
      let type: 'image' | 'video' | 'audio' = 'image';

      if (mime.startsWith('image')) {
        file = await this.compressImage(file);
      } else if (mime.startsWith('video')) {
        type = 'video';
        const isValid = await this.validateVideo(file);
        if (!isValid) {
          event.target.value = '';
          return;
        }
      } else if (mime.startsWith('audio')) {
        type = 'audio';
      } else {
        const t = await this.toast.create({ message: 'Unsupported file type', duration: 2000 });
        t.present();
        event.target.value = '';
        return;
      }

      this.statusService.uploadStatus(file, '', type).subscribe({
        next: async () => {
          const t = await this.toast.create({ message: 'Status Uploaded!', duration: 2000 });
          t.present();
          this.loadStatus();
        },
        error: async () => {
          const t = await this.toast.create({ message: 'Upload failed', duration: 2000 });
          t.present();
        }
      });
    }
    // Reset input
    event.target.value = '';
  }

  // HF Phase 3: Client-side Image Compression (1080px, 75% JPEG)
  private async compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const MAX_WIDTH = 1080;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file); // Fallback

        ctx.drawImage(img, 0, 0, width, height);

        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = outputMime === 'image/jpeg' ? 0.75 : undefined;

        canvas.toBlob((blob) => {
          if (blob) {
            const ext = outputMime === 'image/png' ? '.png' : '.jpg';
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ext), {
              type: outputMime,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, outputMime, quality);
      };
      img.onerror = () => resolve(file);
      img.src = objUrl;
    });
  }

  // HF Phase 3: Video Limits (30s, 5MB, 1080p)
  private async validateVideo(file: File): Promise<boolean> {
    if (file.size > 5 * 1024 * 1024) {
      const t = await this.toast.create({ message: 'Video exceeds 5MB limit', duration: 3000 });
      t.present();
      return false;
    }

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);

      video.onloadedmetadata = async () => {
        URL.revokeObjectURL(objUrl);

        if (video.duration > 30.5) {
          const t = await this.toast.create({ message: 'Video must be 30 seconds or less', duration: 3000 });
          t.present();
          return resolve(false);
        }

        if (video.videoWidth > 1920 || video.videoHeight > 1920) {
          const t = await this.toast.create({ message: 'Video resolution exceeds 1080p max', duration: 3000 });
          t.present();
          return resolve(false);
        }

        resolve(true);
      };

      video.onerror = () => resolve(false);
      video.src = objUrl;
    });
  }

  async viewStatus(userStatus: StatusUser, isOwn: boolean = false) {
    const modal = await this.modalCtrl.create({
      component: StatusViewerPage,
      componentProps: {
        userStatuses: userStatus.updates,
        userName: isOwn ? 'My Status' : userStatus.name,
        userAvatar: userStatus.avatar,
        isOwnStatus: isOwn,
        statusUserId: userStatus.user_id
      }
    });

    await modal.present();

    // Reload after viewing to update viewed status
    modal.onDidDismiss().then(() => {
      this.loadStatus();
    });
  }

  async showViewers(event: Event, status: StatusUser) {
    event.stopPropagation();

    // Get viewers for first status (they all belong to same user anyway for aggregated view)
    const firstStatusId = status.updates[0]?.id;
    if (!firstStatusId) return;

    const viewers: any = await this.statusService.getViewers(firstStatusId).toPromise();

    if (!viewers || viewers.length === 0) {
      const t = await this.toast.create({ message: 'No views yet', duration: 1000 });
      t.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Viewed By',
      inputs: viewers.map((v: any) => ({
        type: 'radio',
        label: `${v.first_name} ${v.last_name} (${new Date(v.viewed_at).toLocaleTimeString()})`,
        value: v.viewer_id,
        disabled: true
      })),
      buttons: ['Close']
    });
    await alert.present();
  }

  async showStatusOptions(event: Event, userStatus: StatusUser) {
    event.stopPropagation();

    const isMuted = this.statusService.isUserMuted(userStatus.user_id);

    const actionSheet = await this.actionSheetCtrl.create({
      header: userStatus.name,
      buttons: [
        {
          text: isMuted ? 'Unmute Status Updates' : 'Mute Status Updates',
          icon: 'volume-mute',
          handler: () => {
            this.statusService.muteUser(userStatus.user_id, !isMuted).subscribe({
              next: async () => {
                const t = await this.toast.create({
                  message: isMuted ? 'Status unmuted' : 'Status muted',
                  duration: 2000
                });
                t.present();
                this.loadStatus();
              }
            });
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  hasUnviewedUpdates(status: StatusUser): boolean {
    return status.updates.some(u => !this.statusService.isViewed(u.id));
  }

  getViewedSegments(status: StatusUser): { viewed: number; total: number } {
    const viewed = status.updates.filter(u => this.statusService.isViewed(u.id)).length;
    return { viewed, total: status.updates.length };
  }

  // Safe accessor for first status media URL (Images only)
  getFirstMediaUrl(status: StatusUser | null): string {
    if (status && status.updates && status.updates.length > 0) {
      const first = status.updates[0];
      console.log('[StatusDebug] Type:', first.type, 'Media:', first.media_url);

      if (first.type === 'image') {
        const url = first.media_url || '';
        return url;
      }
    }
    console.log('[StatusDebug] Fallback to Profile');
    return '';
  }

  // Safe accessor for last status timestamp
  getLastStatusTime(status: StatusUser): string {
    if (status.updates && status.updates.length > 0) {
      return status.updates[status.updates.length - 1]?.created_at || '';
    }
    return '';
  }
}

