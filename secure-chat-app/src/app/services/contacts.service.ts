import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { LoggingService } from './logging.service';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class ContactsService {
    localContacts: any[] = [];
    private db: any;

    constructor(private api: ApiService, private logger: LoggingService) {
        try {
            this.db = getFirestore();
        } catch (e) {
            this.logger.error("Firestore Init Error", e);
        }
    }

    async getContacts() {
        if (!Capacitor.isNativePlatform()) {
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

            type ContactPhone = { number?: string };
            type ContactPayload = { phones?: ContactPhone[] };

            (rawContacts as ContactPayload[]).forEach(c => {
                if (c.phones && c.phones.length > 0) {
                    c.phones.forEach(p => {
                        let num = p.number?.replace(/[^0-9+]/g, '');
                        if (num && num.length >= 10) {
                            phoneNumbers.push(num);
                        }
                    });
                }
            });

            const uniquePhones = [...new Set(phoneNumbers)];
            return this.syncPhone(uniquePhones);

        } catch (e) {
            this.logger.error("Contact Sync Error", e);
            return [];
        }
    }

    async syncPhone(phones: string[]) {
        const res: any = await this.api.post('contacts.php', { phone_numbers: phones }).toPromise();
        return res;
    }

    async saveManualContact(contact: any) {
        const myId = localStorage.getItem('user_id');
        if (!myId || !this.db) return;
        try {
            await setDoc(doc(this.db, 'users', myId, 'contacts', contact.user_id), contact);
        } catch (e) {
            this.logger.error("Failed to save contact", e);
        }
    }

    async getSavedContacts(): Promise<any[]> {
        const myId = localStorage.getItem('user_id');
        if (!myId || !this.db) return [];
        try {
            const snap = await getDocs(collection(this.db, 'users', myId, 'contacts'));
            return snap.docs.map(d => d.data());
        } catch (e) { return []; }
    }

    async getAllContacts() {
        const native = await this.getContacts() || [];
        const saved = await this.getSavedContacts() || [];

        const map = new Map();

        // 1. Add Saved (Base)
        saved.forEach(c => map.set(c.user_id, c));

        // 2. Merge Native (Fresh Server Data)
        // If native exists, update profile fields but KEEP displayName if set in saved
        native.forEach((n: any) => {
            if (map.has(n.user_id)) {
                const existing = map.get(n.user_id);
                map.set(n.user_id, {
                    ...existing, // Keep nickname/local fields
                    first_name: n.first_name, // Update Fresh Profile
                    last_name: n.last_name,
                    photo_url: n.photo_url,
                    public_key: n.public_key,
                    short_note: n.short_note || existing.short_note // Optional
                });
            } else {
                map.set(n.user_id, n);
            }
        });

        const merged = Array.from(map.values());
        this.localContacts = merged; // Update public property for ChatsPage
        return merged;
    }
}
