import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalController, IonSearchbar, IonicModule } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-search-modal',
    templateUrl: './search-modal.page.html',
    styleUrls: ['./search-modal.page.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
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
            // v2.3: Message search disabled to preserve E2EE integrity.
            // In future, implement searchable encryption or local indexing after decryption.
            this.results = [];
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
