import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { LoggingService } from './logging.service';
import { StorageService } from './storage.service';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class ContactsService {

    localContacts: any[] = [];
    private db: any;

    constructor(
        private api: ApiService,
        private logger: LoggingService,
        private storage: StorageService
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

        // 1. Try to load from Cache first for instant UI
        const cached = await this.storage.getCachedContacts();
        if (cached && cached.length > 0) {
            console.log('[ContactsService] Loaded from cache:', cached.length);
            this.localContacts = this.normalizeContacts(cached, myId);

            // Trigger background sync only if needed (e.g. every 1 hour)
            const lastSync = parseInt(localStorage.getItem('last_contacts_sync') || '0');
            if (Date.now() - lastSync > 3600000) {
                this.syncInBackground(myId);
            }

            return this.localContacts;
        }

        // 2. Fallback to full sync if cache is empty
        return await this.syncInBackground(myId);
    }

    private async syncInBackground(myId: string | null) {
        try {
            const devicePhones = await this.getDevicePhones();
            const serverUsers = await this.syncPhone(devicePhones);

            // Save to Cache
            localStorage.setItem('last_contacts_sync', Date.now().toString());
            await this.storage.saveContacts(serverUsers);

            this.localContacts = this.normalizeContacts(serverUsers, myId);
            return this.localContacts;
        } catch (e) {
            this.logger.error("Sync in background failed", e);
            return this.localContacts;
        }
    }

    private normalizeContacts(contacts: any[], myId: string | null) {
        const filtered = contacts.filter(u => u.user_id !== myId);
        const normalized = filtered.map(u => ({
            ...u,
            displayName: u.first_name || u.last_name || u.phone_number || 'Unknown'
        }));
        normalized.sort((a, b) => a.displayName.localeCompare(b.displayName));
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
        if (!query || query.length < 2) return [];

        try {
            // 1. Try Cache
            const cached = await this.storage.getMeta(`search:${query}`);
            if (cached) return cached;

            const res: any = await this.api.post('contacts.php', { query }).toPromise();
            const results = Array.isArray(res) ? res : [];

            // 2. Save Cache (5 mins)
            if (results.length > 0) {
                this.storage.setMeta(`search:${query}`, results);
            }

            return results;
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
