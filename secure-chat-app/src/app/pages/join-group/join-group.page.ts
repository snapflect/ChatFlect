
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { ChatService } from 'src/app/services/chat.service';

@Component({
    selector: 'app-join-group',
    templateUrl: './join-group.page.html',
    styleUrls: ['./join-group.page.scss'],
    standalone: false
})
export class JoinGroupPage implements OnInit {
    code: string | null = null;
    isLoading = true;
    statusMessage = 'Verifying invite...';

    constructor(
        private route: ActivatedRoute,
        private api: ApiService,
        private nav: NavController,
        private chatService: ChatService,
        private toast: ToastController
    ) { }

    ngOnInit() {
        this.code = this.route.snapshot.paramMap.get('code');
        if (this.code) {
            this.joinGroup();
        } else {
            this.statusMessage = 'Invalid Link';
            this.isLoading = false;
        }
    }

    async joinGroup() {
        const userId = localStorage.getItem('user_id');
        try {
            const res: any = await this.api.post('groups.php', {
                action: 'join_via_code',
                code: this.code,
                user_id: userId
            }).toPromise();

            if (res && res.status === 'success') {
                const groupId = res.group_id;
                // Optionally create in Firestore if not exists (handled by ChatService usually)
                // Just navigate to chat
                this.showToast(`Joined ${res.group_name}!`);

                // Ensure ChatService knows about this chat (add to local list/cache if needed)
                // Navigate
                this.nav.navigateRoot(['/chat-detail', groupId]);
            } else {
                this.statusMessage = res.error || 'Link expired or invalid';
                this.isLoading = false;
            }
        } catch (e) {
            this.statusMessage = 'Connection Failed';
            this.isLoading = false;
        }
    }

    async showToast(msg: string) {
        const t = await this.toast.create({ message: msg, duration: 2000 });
        t.present();
    }

    goHome() {
        this.nav.navigateRoot('/tabs/chats');
    }
}
