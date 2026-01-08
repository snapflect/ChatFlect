import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';

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
        private auth: AuthService
    ) {
        this.auth.currentUserId.subscribe(id => this.currentUserId = id);
    }

    ngOnInit() {
        this.chatService.getChats(this.currentUserId).subscribe(chats => {
            this.chats = chats;
        });
    }

    selectChat(chat: any) {
        this.modalCtrl.dismiss({
            selectedChatId: chat.id,
            selectedChatName: chat.isGroup ? chat.groupName : (chat.otherUser?.first_name || 'Chat')
        });
    }

    close() {
        this.modalCtrl.dismiss();
    }
}
