import { Component, OnInit } from '@angular/core';
import { ContactsService } from 'src/app/services/contacts.service';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { ChatService } from 'src/app/services/chat.service';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: false
})
export class ContactsPage implements OnInit {
  contacts: any[] = [];

  constructor(
    private contactsService: ContactsService,
    private chatService: ChatService,
    private router: Router,
    private toast: ToastController
  ) { }

  ngOnInit() {
    this.loadContacts();
  }

  async loadContacts() {
    try {
      const res: any = await this.contactsService.getContacts();
      if (Array.isArray(res)) {
        const myId = localStorage.getItem('user_id');
        // Filter out my own user_id
        this.contacts = res.filter((c: any) => String(c.user_id) !== String(myId));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async startChat(contact: any) {
    if (!contact.user_id && !contact.id) return;
    const targetId = contact.user_id || contact.id; // API returns user_id, fallback to id

    try {
      const chatId = await this.chatService.getOrCreateChat(targetId);
      this.router.navigate(['/chat-detail', chatId]);
    } catch (e: any) {
      console.error("Chat Init Error", e);
      const t = await this.toast.create({ message: 'Chat Error: ' + e.message, duration: 2000 });
      t.present();
    }
  }
}
