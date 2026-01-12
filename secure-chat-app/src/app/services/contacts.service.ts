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

    async getContacts(): Promise<any[]> {
        if (!Capacitor.isNativePlatform()) {
            const mockDeviceContacts = ['111111', '222222', '333333'];
            return this.api.post('contacts.php', { phone_numbers: mockDeviceContacts }).toPromise() as Promise<any[]>;
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
            const phoneToNameMap = new Map<string, string>();
            const phoneNumbers: string[] = [];

            type ContactPhone = { number?: string };
            type ContactPayload = { phones?: ContactPhone[]; displayName?: string; name?: any };

            (rawContacts as any[]).forEach(c => { // Type cast flexible
                const name = c.displayName || (c.name ? (c.name.display || c.name.given) : 'Unknown');

                if (c.phones && c.phones.length > 0) {
                    c.phones.forEach((p: any) => {
                        let num = p.number?.replace(/[^0-9+]/g, '');
                        // Handle standard formats
                        if (num) {
                            if (num.length >= 10) {
                                phoneNumbers.push(num);
                                phoneToNameMap.set(num, name);
                                phoneToNameMap.set(num.slice(-10), name);
                            }
                        }
                    });
                }
            });

            const uniquePhones = [...new Set(phoneNumbers)];
            const serverUsers: any[] = await this.syncPhone(uniquePhones);

            // Merge Local Name
            return serverUsers.map(u => {
                // Try to find local name
                const pClean = u.phone_number.replace(/[^0-9]/g, '');
                const last10 = pClean.slice(-10);

                const localName = phoneToNameMap.get(last10) || phoneToNameMap.get(u.phone_number);
                return {
                    ...u,
                    localName: localName // Attach for fallback
                };
            });

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

    async getAllContacts(): Promise<any[]> {
        const native = await this.getContacts() || [];
        const saved = await this.getSavedContacts() || [];

        const map = new Map();

        // 1. Add Saved (Base)
        (saved as any[]).forEach(c => map.set(c.user_id, c));

        // 2. Merge Native (Fresh Server Data)
        // If native exists, update profile fields but KEEP displayName if set in saved
        (native as any[]).forEach((n: any) => {
            if (map.has(n.user_id)) {

                let pUrl = n.photo_url;
                if (pUrl && !pUrl.startsWith('http')) {
                    pUrl = 'https://chat.snapflect.com/' + pUrl;
                }

                const existing = map.get(n.user_id);
                map.set(n.user_id, {
                    ...existing, // Keep nickname/local fields
                    first_name: n.first_name || n.localName, // Update Fresh Profile or Fallback
                    last_name: n.last_name,
                    photo_url: pUrl,
                    public_key: n.public_key,
                    short_note: n.short_note || existing.short_note
                });
            } else {
                let pUrl = n.photo_url;
                if (pUrl && !pUrl.startsWith('http')) {
                    pUrl = 'https://chat.snapflect.com/' + pUrl;
                }

                map.set(n.user_id, {
                    ...n,
                    photo_url: pUrl,
                    first_name: n.first_name || n.localName // Fallback to local name
                });
            }
        });

        const merged = Array.from(map.values());
        this.logger.log("[Contacts] Merged Count:", merged.length);
        if (merged.length > 0) {
            this.logger.log("[Contacts] Sample:", merged[0]);
        }
        this.localContacts = merged; // Update public property for ChatsPage
        return merged;
    }
}
