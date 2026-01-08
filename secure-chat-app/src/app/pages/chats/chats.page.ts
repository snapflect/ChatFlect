import { Component, OnInit } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service';
import { ContactsService } from 'src/app/services/contacts.service';

@Component({
  selector: 'app-chats',
  templateUrl: './chats.page.html',
  styleUrls: ['./chats.page.scss'],
  standalone: false
})
export class ChatsPage implements OnInit {
  chats: any[] = [];
  myId = localStorage.getItem('user_id');

  constructor(
    private chatService: ChatService,
    private contactService: ContactsService // Ensure this is injected
  ) { }

  ngOnInit() {
    this.loadChats();
  }

  loadChats() {
    // Ensure contacts are loaded first to map Names
    this.contactService.getContacts().then(() => {
      this.chatService.getMyChats().subscribe(async res => {
        this.chats = res;
        // Resolve Names
        for (const chat of this.chats) {
          if (chat.isGroup) {
            chat.name = chat.groupName || 'Unnamed Group';
            chat.avatar = 'assets/group_placeholder.png'; // Todo: groupIcon
          } else {
            const otherId = chat.participants.find((p: any) => String(p) !== String(this.myId));
            if (otherId) {
              // Try to find in contacts
              const contact = this.contactService.localContacts.find((c: any) => String(c.user_id) === String(otherId));
              if (contact) {
                chat.name = contact.first_name + ' ' + contact.last_name;
                chat.avatar = contact.photo_url;
              } else {
                chat.name = `User ${otherId.substr(0, 4)}`;
              }
            }
          }
        }
        // Filter out empty chats (no lastMessage or very old timestamp default)
        // Filter out empty chats (no lastMessage or very old timestamp default)
        this.chats = this.chats.filter(c => c.lastMessage && c.lastMessage.trim() !== '');
        this.filteredChats = [...this.chats];
      });
    });
  }

  filteredChats: any[] = [];
  searchTerm: string = '';

  filterChats(event: any) {
    const term = event.target.value;
    this.searchTerm = term;
    if (!term || term.trim() === '') {
      this.filteredChats = [...this.chats];
      return;
    }

    this.filteredChats = this.chats.filter(c => {
      return c.name.toLowerCase().includes(term.toLowerCase());
      // Optional: Search last message?
      // || c.lastMessage.toLowerCase().includes(term.toLowerCase())
    });
  }

  getUnreadCount(chat: any) {
    return chat[`unread_${this.myId}`] || 0;
  }
}
