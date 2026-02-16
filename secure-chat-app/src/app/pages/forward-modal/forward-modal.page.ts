import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { ContactResolverService } from 'src/app/services/contact-resolver.service';
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
        private contactResolver: ContactResolverService,
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
        // v2.3: Load all resolved contacts once to avoid multiple DB hits
        const resolvedContacts = await this.contactResolver.getResolvedContacts();

        for (const chat of this.chats) {
            if (chat.isGroup) {
                chat.name = chat.groupName || 'Unnamed Group';
                chat.avatar = chat.groupIcon || 'assets/user.png';
                continue;
            }

            const otherId = chat.participants?.find((p: any) => String(p) !== String(this.currentUserId));
            if (!otherId) continue;

            const contact = resolvedContacts.find(c => String(c.user_id) === String(otherId));

            if (contact) {
                chat.name = contact.display_name;
                chat.avatar = contact.photo_url || 'assets/user.png';
            } else {
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
