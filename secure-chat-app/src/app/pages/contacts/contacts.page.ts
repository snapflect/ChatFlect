import { Component, OnInit } from '@angular/core';
import { ContactsService } from 'src/app/services/contacts.service';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { ChatService } from 'src/app/services/chat.service';
import { Share } from '@capacitor/share';
import { AlertController } from '@ionic/angular';
import { LoggingService } from 'src/app/services/logging.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: false
})


// ...

export class ContactsPage implements OnInit {
  contacts: any[] = [];
  groupedContacts: { letter: string, contacts: any[] }[] = [];
  searchQuery: string = '';

  constructor(
    private contactsService: ContactsService,
    private chatService: ChatService,
    private router: Router,
    private toast: ToastController,
    private alertCtrl: AlertController,
    private logger: LoggingService
  ) { }

  ngOnInit() {
    this.loadContacts();
  }

  async loadContacts(event?: any) {
    this.logger.log("Loading contacts...");

    // 1. Load Cached
    const cached = localStorage.getItem('contacts_cache');
    if (cached) {
      this.contacts = JSON.parse(cached);
      this.updateGroupedContacts();
    }

    // 2. Sync Native in Background
    try {
      const fresh = await this.contactsService.getAllContacts();
      if (fresh) {
        this.contacts = fresh;
        localStorage.setItem('contacts_cache', JSON.stringify(fresh));
        this.updateGroupedContacts();
      }
    } catch (e) {
      this.logger.error("Sync failed", e);
    } finally {
      if (event) event.target.complete();
    }
  }

  updateGroupedContacts() {
    let filtered = this.contacts;

    // Search Filter
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.displayName && c.displayName.toLowerCase().includes(q)) ||
        (c.phone_number && c.phone_number.includes(q)) ||
        (c.short_note && c.short_note.toLowerCase().includes(q))
      );
    }

    // Sort Alphabetically
    filtered.sort((a, b) => (a.displayName || '').localeCompare((b.displayName || ''), undefined, { sensitivity: 'base' }));

    // Group by First Letter
    const groups: { [key: string]: any[] } = {};
    filtered.forEach(c => {
      const letter = (c.displayName || '#').charAt(0).toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    this.groupedContacts = Object.keys(groups).sort().map(letter => ({
      letter,
      contacts: groups[letter]
    }));
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value;
    this.updateGroupedContacts();
  }

  async addContact() {
    const alert = await this.alertCtrl.create({
      header: 'New Contact',
      message: 'Enter phone number (with country code):',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Name (Optional)' },
        { name: 'phone', type: 'tel', placeholder: '+1234567890' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add & Chat',
          handler: async (data) => {
            if (data.phone) {
              await this.manualAdd(data.phone, data.name || data.phone);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async manualAdd(phone: string, name: string) {
    try {
      const res: any = await this.contactsService.syncPhone([phone]);
      if (res && res.length > 0) {
        const user = res[0];
        // Add to local contacts list
        const newContact = {
          ...user,
          displayName: name, // User's custom name for them
          api_user: true
        };

        // Deduplicate
        const exists = this.contacts.find(c => c.user_id === user.user_id);
        if (!exists) {
          this.contacts.push(newContact);
          localStorage.setItem('contacts_cache', JSON.stringify(this.contacts));
          // Persist
          this.contactsService.saveManualContact(newContact);
        }

        this.startChat(newContact);
      } else {
        const t = await this.toast.create({ message: 'User not found.', duration: 2000 });
        t.present();
        // ask to invite
      }
    } catch (e) {
      this.logger.error("Manual Add Error", e);
    }
  }

  async findAndChat(phone: string) {
    // We can use contacts.php to look up ONE number? 
    // contacts.php takes an array. 
    try {
      const res: any = await this.contactsService.syncPhone([phone]);
      if (res && res.length > 0) {
        // Found!
        this.startChat(res[0]);
      } else {
        const t = await this.toast.create({ message: 'User not found on this app.', duration: 2000 });
        t.present();
        // Ask to invite?
        // this.inviteFriend();
      }
    } catch (e) {
      this.logger.error("Error finding contact", e);
    }
  }

  async inviteFriend() {
    try {
      const myId = localStorage.getItem('user_id');
      const link = `https://snapflect.com/?ref=${myId}`; // Generalized Invite Link

      await Share.share({
        title: 'Join me on ChatFlect!',
        text: 'Let\'s chat securely! Download ChatFlect here: ',
        url: link,
        dialogTitle: 'Invite Friends'
      });
    } catch (e) {
      if ((e as any).message !== 'Share canceled') { // Ignore user cancellation logic
        this.logger.error("Share failed", e);
      }
    }
  }

  async startChat(contact: any) {
    if (!contact.user_id && !contact.id) return;
    const targetId = contact.user_id || contact.id; // API returns user_id, fallback to id

    try {
      const chatId = await this.chatService.getOrCreateChat(targetId);
      this.router.navigate(['/chat-detail', chatId]);
    } catch (e: any) {
      this.logger.error("Chat Init Error", e);
      const msg = (e && e.message) ? e.message : 'Detailed error unavailable';
      const t = await this.toast.create({ message: 'Chat Error: ' + msg, duration: 2000 });
      t.present();
    }
  }
}
