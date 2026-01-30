import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalController, IonSearchbar } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';

@Component({
    selector: 'app-search-modal',
    templateUrl: './search-modal.page.html',
    styleUrls: ['./search-modal.page.scss'],
})
export class SearchModalPage implements OnInit {
    @ViewChild(IonSearchbar) searchbar!: IonSearchbar;
    results: any[] = [];
    query: string = '';
    isSearching: boolean = false;

    constructor(
        private modalCtrl: ModalController,
        private storage: StorageService
    ) { }

    ngOnInit() {
        setTimeout(() => this.searchbar.setFocus(), 500);
    }

    async onSearch(event: any) {
        this.query = event.target.value;
        if (!this.query || this.query.trim().length < 2) {
            this.results = [];
            return;
        }

        this.isSearching = true;
        try {
            this.results = await this.storage.searchMessages(this.query);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            this.isSearching = false;
        }
    }

    selectMessage(msg: any) {
        this.modalCtrl.dismiss({
            messageId: msg.id,
            chatId: msg.chatId || msg.chat_id // Ensure formatting
        });
    }

    close() {
        this.modalCtrl.dismiss();
    }
}
