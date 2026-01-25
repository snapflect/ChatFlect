import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { LoggingService } from './logging.service';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class ContactsService {

    localContacts: any[] = [];
    private db: any;

    constructor(
        private api: ApiService,
        private logger: LoggingService
    ) {
        try {
            this.db = getFirestore();
        } catch { }
    }

    /* ================================
       PUBLIC API
    ================================= */

    async getAllContacts(): Promise<any[]> {
        const myId = localStorage.getItem('user_id');

        const devicePhones = await this.getDevicePhones();
        const serverUsers = await this.syncPhone(devicePhones);

        // Exclude self
        const filtered = serverUsers.filter(u => u.user_id !== myId);

        // Normalize display name
        const normalized = filtered.map(u => ({
            ...u,
            displayName:
                u.first_name ||
                u.last_name ||
                u.phone_number ||
                'Unknown'
        }));

        // Sort alphabetically
        normalized.sort((a, b) =>
            a.displayName.localeCompare(b.displayName)
        );

        this.localContacts = normalized;
        return normalized;
    }

    /* ================================
       DEVICE CONTACTS
    ================================= */

    private async getDevicePhones(): Promise<string[]> {
        if (!Capacitor.isNativePlatform()) return [];

        try {
            console.log('[ContactsDebug] Requesting Permissions...');
            const perm = await Contacts.requestPermissions();
            console.log('[ContactsDebug] Permission Result:', JSON.stringify(perm));

            if (perm.contacts !== 'granted') {
                console.warn('[ContactsDebug] Permission denied or not granted.');
                return [];
            }

            const res = await Contacts.getContacts({
                projection: { phones: true }
            });
            console.log('[ContactsDebug] Raw Contacts Count:', res.contacts.length);

            const phones: string[] = [];

            res.contacts.forEach((c: any) => {
                c.phones?.forEach((p: any) => {
                    const raw = p.number;
                    const clean = raw?.replace(/[^0-9]/g, '');
                    console.log('[ContactsDebug] Raw:', raw, 'Clean:', clean);
                    if (clean && clean.length >= 10) {
                        const final = clean.slice(-10);
                        console.log('[ContactsDebug] Normalized:', final);
                        phones.push(final);
                    }
                });
            });

            return [...new Set(phones)];
        } catch (e) {
            this.logger.error("Device contacts error", e);
            return [];
        }
    }

    /* ================================
       BACKEND SYNC (TS-SAFE)
    ================================= */

    async syncPhone(phones: string[]): Promise<any[]> {
        if (!phones || phones.length === 0) return [];

        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < phones.length; i += batchSize) {
            batches.push(phones.slice(i, i + batchSize));
        }

        console.log(`[ContactsDebug] Syncing ${phones.length} contacts in ${batches.length} batches...`);

        let mergedResults: any[] = [];

        for (const batch of batches) {
            try {
                const res = await this.api
                    .post('contacts.php', { phone_numbers: batch })
                    .toPromise();

                if (Array.isArray(res)) {
                    console.log(`[ContactsDebug] Batch returned ${res.length} matches.`);
                    mergedResults = [...mergedResults, ...res];
                }
            } catch (e) {
                this.logger.error('[ContactsDebug] Batch sync failed', e);
            }
        }

        // Deduplicate merged results by user_id
        const unique = mergedResults.filter((v, i, a) => a.findIndex(t => t.user_id === v.user_id) === i);
        console.log(`[ContactsDebug] Total Unique Matches: ${unique.length}`);

        return unique;
    }

    async searchGlobal(query: string): Promise<any[]> {
        try {
            const res: any = await this.api.post('contacts.php', { query }).toPromise();
            return Array.isArray(res) ? res : [];
        } catch (e) {
            this.logger.error("Global search failed", e);
            return [];
        }
    }

    /* ================================
       MANUAL CONTACTS
    ================================= */

    async saveManualContact(contact: any) {
        const myId = localStorage.getItem('user_id');
        if (!myId || !this.db) return;

        try {
            await setDoc(
                doc(this.db, 'users', myId, 'contacts', contact.user_id),
                contact
            );
        } catch (e) {
            this.logger.error("Save manual contact failed", e);
        }
    }

    async getSavedContacts(): Promise<any[]> {
        const myId = localStorage.getItem('user_id');
        if (!myId || !this.db) return [];

        try {
            const snap = await getDocs(collection(this.db, 'users', myId, 'contacts'));
            return snap.docs.map(d => d.data());
        } catch {
            return [];
        }
    }
}
