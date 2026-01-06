import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';

@Injectable({
    providedIn: 'root'
})
export class ContactsService {
    localContacts: any[] = [];

    constructor(private api: ApiService) { }

    async getContacts() {
        if (!Capacitor.isNativePlatform()) {
            // Web Fallback (Still keep mock for browser testing)
            const mockDeviceContacts = ['111111', '222222', '333333'];
            return this.api.post('contacts.php', { phone_numbers: mockDeviceContacts }).toPromise();
        }

        try {
            const permission = await Contacts.requestPermissions();
            if (permission.contacts !== 'granted') return [];

            const result = await Contacts.getContacts({
                projection: {
                    name: true,
                    phones: true
                }
            });

            const rawContacts = result.contacts;
            const phoneNumbers: string[] = [];

            // Define types inline to avoid import issues from plugin versions
            type ContactPhone = { number?: string };
            type ContactPayload = { phones?: ContactPhone[] };

            (rawContacts as ContactPayload[]).forEach(c => {
                if (c.phones && c.phones.length > 0) {
                    c.phones.forEach(p => {
                        let num = p.number?.replace(/[^0-9+]/g, ''); // Keep only digits and +
                        if (num && num.length >= 10) {
                            phoneNumbers.push(num);
                        }
                    });
                }
            });

            // Deduplicate
            const uniquePhones = [...new Set(phoneNumbers)];

            // Send to API to find registered matches
            const res: any = await this.api.post('contacts.php', { phone_numbers: uniquePhones }).toPromise();
            this.localContacts = res || [];
            return res;

        } catch (e) {
            console.error("Contact Sync Error", e);
            // FALLBACK: Return Demo Contacts on Error/Permission Denial
            return [
                { id: 999, first_name: 'Demo', last_name: 'Bot', phone_number: '111111', photo_url: '' },
                { id: 888, first_name: 'Test', last_name: 'User', phone_number: '222222', photo_url: '' }
            ];
        }
    }
}
