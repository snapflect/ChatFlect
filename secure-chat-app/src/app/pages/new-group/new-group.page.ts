import { Component, OnInit } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { ContactsService } from 'src/app/services/contacts.service';
import { ChatService } from 'src/app/services/chat.service';
import { LoggingService } from 'src/app/services/logging.service';

@Component({
  selector: 'app-new-group',
  templateUrl: './new-group.page.html',
  styleUrls: ['./new-group.page.scss'],
  standalone: false
})
export class NewGroupPage implements OnInit {
  contacts: any[] = [];
  selectedContacts: string[] = [];
  groupName: string = '';

  constructor(
    private contactsService: ContactsService,
    private chatService: ChatService,
    private nav: NavController,
    private toast: ToastController,
    private logger: LoggingService
  ) { }

  ngOnInit() {
    this.loadContacts();
  }

  async loadContacts() {
    this.contacts = (await this.contactsService.getContacts()) || [];
  }

  toggleSelection(userId: string) {
    const id = String(userId);
    if (this.selectedContacts.includes(id)) {
      this.selectedContacts = this.selectedContacts.filter(x => x !== id);
    } else {
      this.selectedContacts.push(id);
    }
  }

  async createGroup() {
    if (!this.groupName.trim()) {
      this.showToast('Please enter a group name');
      return;
    }
    if (this.selectedContacts.length === 0) {
      this.showToast('Select at least one member');
      return;
    }

    try {
      await this.chatService.createGroup(this.groupName, this.selectedContacts);
      this.showToast('Group created!');
      this.nav.navigateBack('/tabs/chats');
    } catch (e: any) {
      this.logger.error("Create Group Error", e);
      this.showToast('Failed to create group: ' + e.message);
    }
  }

  async showToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 2000 });
    t.present();
  }
}
