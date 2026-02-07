import { Component, OnInit } from '@angular/core';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from 'src/app/services/chat.service';
import { SignalService } from 'src/app/services/signal.service';
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
    chatDetails: any = null;
    sharedMedia: any[] = [];
    isLoadingMedia = true;

    constructor(
        private route: ActivatedRoute,
        private nav: NavController,
        private chatService: ChatService,
        private signalService: SignalService, // Injected
        private alertCtrl: AlertController,
        private toastCtrl: ToastController
    ) { }

    // ... (existing ngOnInit/loadUserInfo) ...

    async verifySafetyNumber() {
        if (!this.userId) return;

        const safetyNumber = await this.signalService.getSafetyNumber(this.userId);

        if (!safetyNumber) {
            const toast = await this.toastCtrl.create({
                message: 'Safety number not available (No established session)',
                duration: 2000
            });
            toast.present();
            return;
        }

        const alert = await this.alertCtrl.create({
            header: 'Verify Safety Number',
            subHeader: this.user?.username || 'User',
            message: `<div style="text-align: center; font-family: monospace; font-size: 1.2em; letter-spacing: 2px; margin: 10px 0;">${safetyNumber}</div>
                      <p style="font-size: 0.9em; color: #666;">Compare this number with the one on your contact's device to verify encryption security.</p>`,
            cssClass: 'safety-number-alert',
            buttons: ['OK']
        });

        await alert.present();
    }


    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.userId = params['userId'];
            this.chatId = params['chatId'];

            if (this.userId) {
                this.loadUserInfo();
            }
            if (this.chatId) {
                this.loadSharedMedia();
                this.chatService.getChatDetails(this.chatId).subscribe(details => {
                    this.chatDetails = details;
                });
            }
        });
    }

    async loadUserInfo() {
        if (!this.userId) return;
        this.user = await this.chatService.getUserInfo(this.userId);
    }

    async configureDisappearingMessages() {
        if (!this.chatId) return;

        const currentTimer = this.chatDetails?.autoDeleteTimer || 0;

        const alert = await this.alertCtrl.create({
            header: 'Disappearing Messages',
            message: 'Automatically delete new messages after a set time.',
            inputs: [
                {
                    name: 'off',
                    type: 'radio',
                    label: 'Off',
                    value: 0,
                    checked: currentTimer === 0
                },
                {
                    name: '24h',
                    type: 'radio',
                    label: '24 Hours',
                    value: 86400000,
                    checked: currentTimer === 86400000
                },
                {
                    name: '7d',
                    type: 'radio',
                    label: '7 Days',
                    value: 604800000,
                    checked: currentTimer === 604800000
                },
                {
                    name: '90d',
                    type: 'radio',
                    label: '90 Days',
                    value: 7776000000,
                    checked: currentTimer === 7776000000
                }
            ],
            buttons: [
                {
                    text: 'Cancel',
                    role: 'cancel'
                },
                {
                    text: 'Set',
                    handler: (value) => {
                        this.chatService.setChatTimer(this.chatId!, value).then(async () => {
                            const toast = await this.toastCtrl.create({
                                message: value > 0 ? 'Disappearing messages turned on' : 'Disappearing messages turned off',
                                duration: 2000
                            });
                            toast.present();
                        });
                    }
                }
            ]
        });

        await alert.present();
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
