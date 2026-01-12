import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ContactsService } from 'src/app/services/contacts.service';
import { ChatService } from 'src/app/services/chat.service';
import { LoggingService } from 'src/app/services/logging.service';
import { ApiService } from 'src/app/services/api.service';

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
  groupIconUrl: SafeUrl | string | null = null;
  rawIconUrl: string | null = null; // for upload
  isUploading = false;

  constructor(
    private contactsService: ContactsService,
    private chatService: ChatService,
    private nav: NavController,
    private toast: ToastController,
    private logger: LoggingService,
    private api: ApiService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
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
      await this.chatService.createGroup(this.groupName, this.selectedContacts, this.rawIconUrl || undefined);
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

  triggerFile() {
    document.getElementById('groupIconInput')?.click();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      await this.uploadGroupIcon(file);
    }
  }

  async uploadGroupIcon(file: File) {
    this.isUploading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res: any = await this.api.post('upload.php', formData).toPromise();
      if (res && res.url) {
        this.rawIconUrl = res.url;
        this.groupIconUrl = this.sanitizer.bypassSecurityTrustUrl(res.url); // Sanitize
        // Force update if needed, though simple property change usually works 
        // Adding specific log to verify url
        this.logger.log("Icon Uploaded: " + res.url);
        this.cdr.detectChanges();
      }
    } catch (e: any) {
      this.logger.error("Group Icon Upload Failed", e);
      this.showToast('Failed to upload icon');
    } finally {
      this.isUploading = false;
    }
  }
}
