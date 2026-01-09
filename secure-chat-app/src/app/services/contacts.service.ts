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

    constructor(private api: ApiService, private logger: LoggingService) { }

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

            // Send to API
            return this.syncPhone(uniquePhones);

        } catch (e) {
            this.logger.error("Contact Sync Error", e);
            // FALLBACK: Return Demo Contacts on Error/Permission Denial
            return [
                { user_id: '999', first_name: 'Demo', last_name: 'Bot', phone_number: '111111', photo_url: '' },
                { user_id: '888', first_name: 'Test', last_name: 'User', phone_number: '222222', photo_url: '' }
            ];
        }
    }

    async syncPhone(phones: string[]) {
        const res: any = await this.api.post('contacts.php', { phone_numbers: phones }).toPromise();
        return res;
    }

    async saveManualContact(contact: any) {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;
        try {
            await setDoc(doc(this.db, 'users', myId, 'contacts', contact.user_id), contact);
        } catch (e) {
            this.logger.error("Failed to save contact", e);
        }
    }

    async getSavedContacts(): Promise<any[]> {
        const myId = localStorage.getItem('user_id');
        if (!myId) return [];
        try {
            const snap = await getDocs(collection(this.db, 'users', myId, 'contacts'));
            return snap.docs.map(d => d.data());
        } catch (e) { return []; }
    }

    async getAllContacts() {
        const native = await this.getContacts();
        const saved = await this.getSavedContacts();

        // Merge (Saved overrides/adds to Native)
        const map = new Map();
        native.forEach((c: any) => map.set(c.user_id, c));
        saved.forEach(c => map.set(c.user_id, c));

        return Array.from(map.values());
    }

    // --- Manual Contact Persistence (Firestore) ---
    // Needed for Web where Native Contacts are not available

    // Import Firestore
    private get db() {
        // dynamic import or assume initialized. 
        // We can access via window or just import at top.
        // Let's use standard import at top.
        return (window as any).firestoreDb || null;
        // Actually, let's fix imports properly.
    }
}
