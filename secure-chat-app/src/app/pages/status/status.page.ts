import { Component, OnInit } from '@angular/core';
import { StatusService } from 'src/app/services/status.service';
import { ModalController, ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { StatusViewerPage } from '../status-viewer/status-viewer.page';
import { ProfileService } from 'src/app/services/profile.service';

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

  constructor(
    private statusService: StatusService,
    private profileService: ProfileService,
    private modalCtrl: ModalController,
    private toast: ToastController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController
  ) { }

  ionViewWillEnter() {
    this.myUserId = localStorage.getItem('user_id') || '';
    this.loadStatus();
    this.loadProfile();
  }

  ngOnInit() {
    // Initial setup handled in ionViewWillEnter
  }

  async loadProfile() {
    const p: any = await this.profileService.getProfile();
    if (p) {
      this.myProfilePic = p.photo_url;
    }
  }

  loadStatus() {
    this.statusService.getFeed(this.myUserId).subscribe((res: any) => {
      // Ensure res is an array
      const feedData = Array.isArray(res) ? res : [];
      // Group by user
      const userMap = new Map<string, StatusUser>();

      feedData.forEach((status: any) => {
        const userId = status.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: userId,
            name: `${status.first_name || ''} ${status.last_name || ''}`.trim() || 'Unknown',
            avatar: status.user_photo || '',
            updates: [],
            view_count: 0,
            is_muted: status.is_muted || false
          });
        }
        const user = userMap.get(userId)!;
        user.updates.push({
          id: status.id,
          type: status.type,
          media_url: status.media_url,
          content_url: status.media_url, // Alias for compatibility
          text_content: status.text_content,
          background_color: status.background_color,
          font: status.font,
          caption: status.caption,
          created_at: status.created_at,
          view_count: status.view_count
        });
        user.view_count = (user.view_count || 0) + parseInt(status.view_count || '0');
      });

      // Separate into categories
      this.myStatus = userMap.get(this.myUserId) || null;
      userMap.delete(this.myUserId);

      const others = Array.from(userMap.values());

      // Separate muted, viewed, and recent
      this.mutedUpdates = others.filter(u => u.is_muted);
      const notMuted = others.filter(u => !u.is_muted);

      // Check which users have been fully viewed
      this.viewedUpdates = notMuted.filter(u =>
        u.updates.every(update => this.statusService.isViewed(update.id))
      );
      this.recentUpdates = notMuted.filter(u =>
        u.updates.some(update => !this.statusService.isViewed(update.id))
      );
    });
  }

  async uploadStatus(event: any) {
    const file = event.target.files[0];
    if (file) {
      const mime = file.type;
      let type: 'image' | 'video' | 'audio' = 'image';

      if (mime.startsWith('video')) {
        type = 'video';
      } else if (mime.startsWith('audio')) {
        type = 'audio';
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

