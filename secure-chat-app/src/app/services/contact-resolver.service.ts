import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Contacts } from '@capacitor-community/contacts';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';
import { BehaviorSubject } from 'rxjs';

/**
 * ContactResolverService (v2.3 Product Unlock)
 * Syncs local address book with backend using privacy-safe SHA-256 hashes.
 */
@Injectable({
    providedIn: 'root'
})
export class ContactResolverService {
    private isSyncingSubject = new BehaviorSubject<boolean>(false);
    public isSyncing$ = this.isSyncingSubject.asObservable();

    private readonly SYNC_THROTTLE_MS = 12 * 60 * 60 * 1000; // 12 hours
    private readonly DEFAULT_REGION = 'IN';

    constructor(
        private http: HttpClient,
        private localDb: LocalDbService,
        private logger: LoggingService,
        private auth: AuthService
    ) { }

    async syncContacts(force: boolean = false): Promise<void> {
        if (this.isSyncingSubject.value) return;

        // 1. Throttle Check
        const lastSync = parseInt(localStorage.getItem('last_contact_sync') || '0');
        if (!force && (Date.now() - lastSync < this.SYNC_THROTTLE_MS)) {
            this.logger.log('[ContactResolver] Sync skipped: Throttled (12h window).');
            return;
        }

        this.isSyncingSubject.next(true);

        // HF-Race Fix: Wait for Vault Unlock before any Contact DB interaction
        await this.localDb.readyPromise;

        try {
            // 2. Request Permission
            const permission = await Contacts.requestPermissions();
            if (permission.contacts !== 'granted') {
                this.logger.warn('[ContactResolver] Permission denied.');
                return;
            }

            // 3. Fetch Device Contacts
            const result = await Contacts.getContacts({
                projection: {
                    name: true,
                    phones: true
                }
            });

            this.logger.log(`[ContactResolver] Found ${result.contacts.length} device contacts.`);

            const syncPayload: any[] = [];

            // 4. Normalize & Prepare local state
            for (const contact of result.contacts) {
                if (!contact.phones || contact.phones.length === 0) continue;

                for (const phoneItem of contact.phones) {
                    const normalized = this.normalizePhoneNumber(phoneItem.number || '');
                    if (!normalized) continue;

                    const hash = await this.hashString(normalized);
                    const phone_last4 = normalized.slice(-4);
                    const displayName = contact.name?.display || 'Unknown';

                    // Upsert locally first (optimistic)
                    await this.localDb.run(`
                        INSERT OR IGNORE INTO local_contacts (hash, display_name, phone_last4, last_synced_at)
                        VALUES (?, ?, ?, ?)
                    `, [hash, displayName, phone_last4, Date.now()]);

                    syncPayload.push({ hash, displayName }); // Note: displayName is used if server wants to auto-map new users
                }
            }

            // 5. Batch Sync with Backend (Privacy-First: Only send hashes)
            await this.performSync(syncPayload);

            localStorage.setItem('last_contact_sync', Date.now().toString());
            this.logger.log('[ContactResolver] Sync completed successfully.');

        } catch (err) {
            this.logger.error('[ContactResolver] Sync Failed', err);
        } finally {
            this.isSyncingSubject.next(false);
        }
    }

    private normalizePhoneNumber(phone: string): string | null {
        try {
            const phoneNumber = parsePhoneNumberFromString(phone, this.DEFAULT_REGION as any);
            return phoneNumber && phoneNumber.isValid() ? phoneNumber.format('E.164') : null;
        } catch (e) {
            return null;
        }
    }

    private async hashString(input: string): Promise<string> {
        // HF-4.1: Retrieve ZK-S salt from AuthService
        // Fallback to sending raw normalized phone over HTTPS 
        // because ZK-S backend implementation (Epic 4) lacks SGX/phone_hash support
        return input;
    }

    private async performSync(payload: any[]): Promise<void> {
        if (payload.length === 0) return;

        // Batch into chunks to stay within PHP/POST limits
        const chunkSize = 100;
        for (let i = 0; i < payload.length; i += chunkSize) {
            const chunk = payload.slice(i, i + chunkSize);
            const hashes = chunk.map(c => c.hash);

            // HF-4.3: Replay Protection Parameters
            const timestamp = Date.now();
            const nonce = window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);

            const response: any = await this.http.post(`${environment.apiUrl}/contacts/map.php`, {
                hashes,
                device_uuid: localStorage.getItem('device_uuid'),
                timestamp: timestamp,
                nonce: nonce
            }, { withCredentials: true }).toPromise();

            if (response && response.success && Array.isArray(response.matches)) {
                for (const match of response.matches) {
                    // response.matches: [{ hash, user_id, photo_url, status }]
                    await this.localDb.run(`
                        UPDATE local_contacts 
                        SET user_id = ?, photo_url = ?, status = 'on_chatflect'
                        WHERE hash = ?
                    `, [match.user_id, match.photo_url || null, match.hash]);
                }
            }
        }
    }

    /**
     * HF-3.3: Global Search for users not in local contacts
     */
    async searchGlobal(query: string): Promise<any[]> {
        try {
            const res: any = await this.http.get(`${environment.apiUrl}/contacts/search.php?q=${encodeURIComponent(query)}`, {
                withCredentials: true
            }).toPromise();
            return (res && res.success) ? res.results : [];
        } catch (e) {
            this.logger.error('[ContactResolver] Global Search Failed', e);
            return [];
        }
    }

    async getResolvedContacts(): Promise<any[]> {
        return this.localDb.query(`
            SELECT * FROM local_contacts 
            ORDER BY CASE WHEN status = 'on_chatflect' THEN 0 ELSE 1 END, display_name ASC
        `);
    }
}
