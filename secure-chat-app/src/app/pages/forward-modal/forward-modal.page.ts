import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { ChangeDetectorRef } from '@angular/core';
import { take } from 'rxjs/operators';

@Component({
    selector: 'app-forward-modal',
    templateUrl: './forward-modal.page.html',
    styleUrls: ['./forward-modal.page.scss'],
    standalone: false
})
export class ForwardModalPage implements OnInit {
    chats: any[] = [];
    currentUserId: any;

    constructor(
        private modalCtrl: ModalController,
        private chatService: ChatService,
        private auth: AuthService,
        private contactService: ContactsService,
        private cdr: ChangeDetectorRef
    ) {
        this.auth.currentUserId.subscribe(id => this.currentUserId = String(id));
    }

    ngOnInit() {
        this.chatService.getMyChats().pipe(take(1)).subscribe(chats => {
            this.chats = [...chats];
            this.resolveChatInfos();
        });
    }

    private async resolveChatInfos() {
        for (const chat of this.chats) {
            if (chat.isGroup) {
                chat.name = chat.groupName || 'Unnamed Group';
                chat.avatar = chat.groupIcon || 'assets/user.png';
                continue;
            }

            const otherId = chat.participants?.find((p: any) => String(p) !== String(this.currentUserId));
            if (!otherId) continue;

            // 1. Check Local Contacts
            const contact = this.contactService.localContacts.find(
                (c: any) => String(c.user_id) === String(otherId)
            );

            if (contact) {
                chat.name = `${contact.first_name} ${contact.last_name || ''}`.trim();
                chat.avatar = contact.photo_url || 'assets/user.png';
            } else {
                // 2. API Fallback
                try {
                    const info = await this.chatService.getUserInfo(otherId);
                    chat.name = info.username || 'User';
                    chat.avatar = info.photo || 'assets/user.png';
                } catch (e) {
                    chat.name = 'User';
                    chat.avatar = 'assets/user.png';
                }
            }
        }
        this.cdr.detectChanges();
    }

    selectChat(chat: any) {
        this.modalCtrl.dismiss({
            selectedChatId: chat.id,
            selectedChatName: chat.name || 'Chat'
        });
    }

    close() {
        this.modalCtrl.dismiss();
    }
}
