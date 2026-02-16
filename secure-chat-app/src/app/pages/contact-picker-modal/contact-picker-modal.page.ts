import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ContactResolverService } from 'src/app/services/contact-resolver.service';

@Component({
  selector: 'app-contact-picker-modal',
  templateUrl: './contact-picker-modal.page.html',
  styleUrls: ['./contact-picker-modal.page.scss'],
  standalone: false
})
export class ContactPickerModalPage implements OnInit {
  contacts: any[] = [];
  groupedContacts: { letter: string, contacts: any[] }[] = [];
  searchQuery = '';

  constructor(
    private modalCtrl: ModalController,
    private contactResolver: ContactResolverService
  ) { }

  ngOnInit() {
    this.loadContacts();
  }

  async loadContacts() {
    try {
      this.contacts = await this.contactResolver.getResolvedContacts();
      this.updateGroupedContacts();

      // Trigger background refresh (throttled)
      this.contactResolver.syncContacts().then(async () => {
        this.contacts = await this.contactResolver.getResolvedContacts();
        this.updateGroupedContacts();
      });
    } catch (e) {
      console.error("Contacts Load Failed", e);
    }
  }

  updateGroupedContacts() {
    let filtered = this.contacts;

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.displayName && c.displayName.toLowerCase().includes(q)) ||
        (c.phone_number && c.phone_number.includes(q))
      );
    }

    filtered.sort((a, b) => (a.displayName || '').localeCompare((b.displayName || ''), undefined, { sensitivity: 'base' }));

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

  selectContact(contact: any) {
    this.modalCtrl.dismiss({
      contact: contact
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
