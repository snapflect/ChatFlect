import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
    selector: 'app-starred-messages',
    templateUrl: './starred-messages.page.html',
    styleUrls: ['./starred-messages.page.scss'],
    standalone: false
})
export class StarredMessagesPage implements OnInit {
    starredMessages: any[] = [];
    isLoading = true;
    currentUserId: string | null = null;
    userCache: Map<string, any> = new Map();

    constructor(
        private chatService: ChatService,
        private auth: AuthService,
        private nav: NavController
    ) {
        this.auth.currentUserId.subscribe(id => this.currentUserId = String(id));
    }

    ngOnInit() {
        this.loadStarredMessages();
    }

    loadStarredMessages() {
        this.isLoading = true;
        this.chatService.getStarredMessages().subscribe(async (messages: any[]) => {
            // Sort by timestamp descending (newest first)
            messages.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            this.starredMessages = messages;
            this.isLoading = false;

            // Resolve user info for each message
            for (const msg of this.starredMessages) {
                if (!this.userCache.has(msg.senderId)) {
                    const info = await this.chatService.getUserInfo(msg.senderId);
                    this.userCache.set(msg.senderId, info);
                }
            }
        });
    }

    getUserName(userId: string): string {
        return this.userCache.get(userId)?.username || 'User';
    }

    getUserPhoto(userId: string): string {
        return this.userCache.get(userId)?.photo || 'assets/avatar_placeholder.png';
    }

    getMsgContent(msg: any): string {
        if (typeof msg.text === 'string') return msg.text;
        if (msg.text?.type === 'image') return '📷 Photo';
        if (msg.text?.type === 'video') return '🎥 Video';
        if (msg.text?.type === 'audio') return '🎵 Audio';
        if (msg.text?.type === 'location') return '📍 Location';
        if (msg.text?.type === 'document') return '📄 ' + (msg.text.name || 'Document');
        return 'Media Message';
    }

    goBack() {
        this.nav.back();
    }

    goToChat(msg: any) {
        if (msg.chatId) {
            this.nav.navigateForward(['/chat-detail', msg.chatId]);
        }
    }

    async unstar(msg: any) {
        if (msg.chatId && msg.id) {
            await this.chatService.toggleStarMessage(msg.chatId, msg.id, false);
        }
    }
}
