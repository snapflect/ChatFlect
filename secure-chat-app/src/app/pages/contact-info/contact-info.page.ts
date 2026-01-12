import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from 'src/app/services/chat.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-contact-info',
    templateUrl: './contact-info.page.html',
    styleUrls: ['./contact-info.page.scss'],
    standalone: false
})
export class ContactInfoPage implements OnInit {
    userId: string | null = null;
    chatId: string | null = null;
    user: any = null;
    sharedMedia: any[] = [];
    isLoadingMedia = true;

    constructor(
        private route: ActivatedRoute,
        private nav: NavController,
        private chatService: ChatService
    ) { }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.userId = params['userId'];
            this.chatId = params['chatId'];

            if (this.userId) {
                this.loadUserInfo();
            }
            if (this.chatId) {
                this.loadSharedMedia();
            }
        });
    }

    async loadUserInfo() {
        if (!this.userId) return;
        this.user = await this.chatService.getUserInfo(this.userId);
    }

    loadSharedMedia() {
        this.isLoadingMedia = true;
        // We need a method to get media messages for a chat.
        // ChatService doesn't have a direct 'getMediaMessages' but we can filter from 'getMessages' 
        // or create a new query. For efficiency, let's reuse getMessages or create a specific query in service.
        // For now, let's assume we can fetch recent messages and filter.
        // Actually, a specific query is better. I'll add `getChatMedia` to ChatService later.
        // For this prototype step, I will use a placeholder or implement the query here if service allows.
        // Let's implement `getSharedMedia` in ChatService.

        this.chatService.getSharedMedia(this.chatId!).pipe(
            map(msgs => msgs.filter(m => m.text && (m.text.type === 'image' || m.text.type === 'video')))
        ).subscribe(media => {
            this.sharedMedia = media;
            this.isLoadingMedia = false;
        });
    }

    goBack() {
        this.nav.back();
    }

    getMediaThumbnail(msg: any) {
        if (msg.text.type === 'image') return msg.text.url || msg.text.thumb;
        if (msg.text.type === 'video') return msg.text.thumb;
        return '';
    }
}
