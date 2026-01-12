
import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ContactsService } from 'src/app/services/contacts.service';

@Component({
    selector: 'app-pick-contact-modal',
    templateUrl: './pick-contact-modal.component.html',
    styleUrls: ['./pick-contact-modal.component.scss'],
    standalone: false
})
export class PickContactModalComponent implements OnInit {
    @Input() excludeIds: string[] = [];

    contacts: any[] = [];
    filteredContacts: any[] = [];
    selectedIds: string[] = [];

    constructor(
        private modalCtrl: ModalController,
        private contactsService: ContactsService
    ) { }

    ngOnInit() {
        this.loadContacts();
    }

    async loadContacts() {
        const all = (await this.contactsService.getContacts()) || [];
        // Filter out already in group
        this.contacts = all.filter((c: any) => !this.excludeIds.includes(String(c.user_id)));
        this.filteredContacts = [...this.contacts];
    }

    toggleSelection(userId: string) {
        const id = String(userId);
        if (this.selectedIds.includes(id)) {
            this.selectedIds = this.selectedIds.filter(x => x !== id);
        } else {
            this.selectedIds.push(id);
        }
    }

    dismiss() {
        this.modalCtrl.dismiss();
    }

    addSelected() {
        this.modalCtrl.dismiss(this.selectedIds);
    }

    filterContacts(event: any) {
        const term = event.target.value?.toLowerCase() || '';
        if (!term) {
            this.filteredContacts = [...this.contacts];
            return;
        }
        this.filteredContacts = this.contacts.filter((c: any) =>
            c.first_name?.toLowerCase().includes(term) ||
            c.last_name?.toLowerCase().includes(term) ||
            c.phone_number?.includes(term)
        );
    }
}
