import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';

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

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private nav: NavController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController, // Fix: Added AlertController
    private toast: ToastController
  ) {
    this.myId = localStorage.getItem('user_id') || '';
  }

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id'); // Ensure route has :id
    this.loadGroupInfo();
  }

  async loadGroupInfo() {
    // 1. Get Group Details (from List for now, ideal: get specific)
    const groups: any = await this.api.get(`groups.php?action=list&user_id=${this.myId}`).toPromise();
    this.group = groups.find((g: any) => g.group_id === this.groupId) || this.group;

    // 2. Get Members
    this.members = await this.api.get(`groups.php?action=members&group_id=${this.groupId}`).toPromise() as any[];

    // 3. Check my role
    const me = this.members.find(m => m.user_id === this.myId);
    this.iAmAdmin = (me && me.role === 'admin');

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
    await this.api.post('groups.php', {
      action, group_id: this.groupId, target_id: member.user_id
    }).toPromise();
    this.loadGroupInfo();
  }

  async removeMember(member: any) {
    await this.api.post('groups.php', {
      action: 'remove_member', group_id: this.groupId, target_id: member.user_id
    }).toPromise();
    this.loadGroupInfo();
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
    const alert = await this.alertCtrl.create({
      header: 'Add Member',
      message: 'Enter the User ID to add (Email lookup coming soon)',
      inputs: [{ name: 'userId', type: 'text', placeholder: 'User UUID' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (data) => {
            if (data.userId) {
              await this.api.post('groups.php', {
                action: 'add_member', group_id: this.groupId, user_id: data.userId
              }).toPromise();
              this.loadGroupInfo();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  openChat(member: any) {
    // Todo: Navigate to 1v1 chat
  }
}
