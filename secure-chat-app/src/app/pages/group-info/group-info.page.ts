import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ActionSheetController, AlertController, ToastController, ModalController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { ChatService } from 'src/app/services/chat.service';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { PickContactModalComponent } from 'src/app/components/pick-contact-modal/pick-contact-modal.component';

@Component({
  selector: 'app-group-info',
  templateUrl: './group-info.page.html',
  styleUrls: ['./group-info.page.scss'],
  standalone: false
})
export class GroupInfoPage implements OnInit {
  groupId: any;
  group: any = { name: 'Loading...' };
  members: any[] = [];
  myId: string = '';
  iAmAdmin: boolean = false;
  db = getFirestore();

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private nav: NavController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private toast: ToastController,
    private chatService: ChatService,
    private cdr: ChangeDetectorRef
  ) {
    this.myId = localStorage.getItem('user_id') || '';
  }

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id'); // Ensure route has :id
    this.loadGroupInfo();
  }

  async loadGroupInfo() {
    // 1. Get Group Details (Merge MySQL + Firestore)
    // MySQL for basic info
    const groups: any = await this.api.get(`groups.php?action=list&user_id=${this.myId}`).toPromise();
    const sqlGroup = groups.find((g: any) => String(g.group_id) === String(this.groupId)) || { name: 'Loading...' };

    // Firestore for Icon & Real-time updates
    const chatDoc = await getDoc(doc(this.db, 'chats', this.groupId));
    let fsGroup = {};
    if (chatDoc.exists()) {
      fsGroup = chatDoc.data();
    }

    this.group = { ...sqlGroup, ...fsGroup };
    // Map Firestore groupName to name if present
    if (this.group.groupName) this.group.name = this.group.groupName;
    if (this.group.groupIcon) this.group.icon_url = this.group.groupIcon;

    // 2. Get Members
    this.members = await this.api.get(`groups.php?action=members&group_id=${this.groupId}`).toPromise() as any[];

    // 3. Check my role
    const me = this.members.find(m => String(m.user_id) === String(this.myId));
    this.iAmAdmin = (me && me.role === 'admin');
    this.cdr.detectChanges();

    // 4. If Admin, get Invite Code
    if (this.iAmAdmin) {
      try {
        const res: any = await this.api.post('groups.php', {
          action: 'get_invite_code',
          group_id: this.groupId
        }).toPromise();
        if (res && res.invite_code) {
          this.inviteCode = res.invite_code;
        }
      } catch (e) {
        console.error("Failed to load invite code", e);
      }
    }
  }

  inviteCode: string | null = null;

  async copyInviteLink() {
    if (!this.inviteCode) return;
    const link = `https://snapflect.com/chat/join/${this.inviteCode}`;
    await navigator.clipboard.writeText(link);
    const t = await this.toast.create({ message: 'Link copied!', duration: 2000 });
    t.present();
  }

  async onMemberClick(member: any) {
    if (member.user_id === this.myId) return; // Can't act on self here

    const buttons = [];

    if (this.iAmAdmin) {
      buttons.push({
        text: member.role === 'admin' ? 'Dismiss as Admin' : 'Make Group Admin',
        handler: () => this.toggleAdmin(member)
      });
      buttons.push({
        text: 'Remove from Group',
        role: 'destructive',
        handler: () => this.removeMember(member)
      });
    }

    buttons.push({ text: 'Message', handler: () => this.openChat(member) });
    buttons.push({ text: 'View Profile', handler: () => { } });
    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({
      header: `${member.first_name} ${member.last_name}`,
      buttons
    });
    await sheet.present();
  }

  async toggleAdmin(member: any) {
    const action = member.role === 'admin' ? 'demote' : 'promote';
    try {
      await this.api.post('groups.php', {
        action, group_id: this.groupId, target_id: member.user_id
      }).toPromise();
      this.showToast(`User ${action}d successfully`);
      this.loadGroupInfo();
    } catch (e) {
      this.showToast('Action failed');
    }
  }

  async removeMember(member: any) {
    try {
      await this.api.post('groups.php', {
        action: 'remove_member', group_id: this.groupId, target_id: member.user_id
      }).toPromise();
      this.showToast('Member removed');
      this.loadGroupInfo(); // Refresh list
    } catch (e) {
      this.showToast('Failed to remove member');
    }
  }

  async regenerateInviteCode() {
    try {
      const res: any = await this.api.post('groups.php', {
        action: 'regenerate_invite_code', group_id: this.groupId
      }).toPromise();
      if (res && res.invite_code) {
        this.inviteCode = res.invite_code;
        this.showToast('Invite link reset!');
      }
    } catch (e) {
      this.showToast('Failed to reset link');
    }
  }

  async leaveGroup() {
    const alert = await this.alertCtrl.create({
      header: 'Exit Group?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Exit', handler: async () => {
            await this.api.post('groups.php', {
              action: 'leave', group_id: this.groupId, user_id: this.myId
            }).toPromise();
            this.nav.navigateBack('/tabs/chats');
          }
        }
      ]
    });
    await alert.present();
  }

  async addMember() {
    // Collect existing member IDs to exclude
    const excludeIds = this.members.map(m => String(m.user_id));

    const modal = await this.modalCtrl.create({
      component: PickContactModalComponent,
      componentProps: { excludeIds }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();

    if (data && data.length > 0) {
      // Loop through selected IDs and add them
      // Note: Ideally backend supports bulk add, or we loop api calls
      const loading = await this.toast.create({ message: 'Adding members...', duration: 2000 });
      loading.present();

      for (const uid of data) {
        try {
          await this.api.post('groups.php', {
            action: 'add_member', group_id: this.groupId, user_id: uid
          }).toPromise();
        } catch (e) {
          console.error("Failed to add " + uid, e);
        }
      }
      loading.dismiss();
      this.loadGroupInfo();
      this.showToast(`Added ${data.length} member(s)`);
    }
  }

  async showToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 2000 });
    t.present();
  }

  async triggerIconUpload() {
    if (!this.iAmAdmin) return;
    document.getElementById('groupIconInput')?.click();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      await this.uploadGroupIcon(file);
    }
  }

  async uploadGroupIcon(file: File) {
    const loading = await this.toast.create({ message: 'Updating icon...', duration: 2000 }); // Simple loading indicator
    loading.present();
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res: any = await this.api.post('upload.php', formData).toPromise();
      if (res && res.url) {
        // Update Firestore
        await updateDoc(doc(this.db, 'chats', this.groupId), {
          groupIcon: res.url
        });
        // Update Local
        this.group.icon_url = res.url;
        this.group.groupIcon = res.url;
        loading.dismiss();
        const t = await this.toast.create({ message: 'Group icon updated!', duration: 1500 });
        t.present();
      }
    } catch (e) {
      console.error(e);
      let t = await this.toast.create({ message: 'Failed to update icon', duration: 2000 });
      t.present();
    }
  }

  async openChat(member: any) {
    if (!member.user_id) return;
    try {
      const chatId = await this.chatService.getOrCreateChat(member.user_id);
      this.nav.navigateForward(['/chat-detail', chatId]);
    } catch (e) {
      console.error("Failed to open chat", e);
      const t = await this.toast.create({ message: 'Could not start chat', duration: 2000 });
      t.present();
    }
  }
}
