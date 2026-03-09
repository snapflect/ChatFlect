import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Contacts } from '@capacitor-community/contacts';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';
import { BehaviorSubject } from 'rxjs';

export interface ResolvedContact {
    hash: string;
    display_name: string;
    server_name: string | null;
    phone_last4: string;
    phone_e164: string | null;
    user_id: string | null;
    status: 'on_chatflect' | 'invite';
    photo_url: string | null;
    short_note: string | null;
}

export interface ResolvedContactsResult {
    registered: ResolvedContact[];
    unregistered: ResolvedContact[];
}

/**
 * ContactResolverService (v3.0 Production)
 * Syncs local address book with backend using privacy-safe SHA-256 hashes.
 * Returns contacts split into registered (on ChatFlect) and unregistered (invite).
 */
@Injectable({
    providedIn: 'root'
})
export class ContactResolverService {
    private isSyncingSubject = new BehaviorSubject<boolean>(false);
    public isSyncing$ = this.isSyncingSubject.asObservable();

    private readonly SYNC_THROTTLE_MS = 12 * 60 * 60 * 1000; // 12 hours
    private readonly DEFAULT_REGION = 'IN';
    private deviceSalt: string | null = null;

    constructor(
        private http: HttpClient,
        private localDb: LocalDbService,
        private logger: LoggingService,
        private auth: AuthService
    ) { }

    /* ================================
       PUBLIC API
    ================================= */

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

            // 3. Fetch ZK-S salt for hashing
            await this.loadSalt();

            // 4. Fetch Device Contacts
            const result = await Contacts.getContacts({
                projection: {
                    name: true,
                    phones: true
                }
            });

            this.logger.log(`[ContactResolver] Found ${result.contacts.length} device contacts.`);

            const syncPayload: { hash: string; displayName: string }[] = [];

            // 5. Normalize, Hash, & Store locally
            for (const contact of result.contacts) {
                if (!contact.phones || contact.phones.length === 0) continue;

                for (const phoneItem of contact.phones) {
                    const e164 = this.normalizePhoneNumber(phoneItem.number || '');
                    if (!e164) continue;

                    const hash = await this.hashPhone(e164);
                    const phoneLast4 = e164.slice(-4);
                    const displayName = contact.name?.display || 'Unknown';

                    // Upsert locally (preserve existing user_id/status if already resolved)
                    await this.localDb.run(`
                        INSERT INTO local_contacts (hash, display_name, phone_last4, phone_e164, last_synced_at)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(hash) DO UPDATE SET 
                            display_name = excluded.display_name,
                            phone_last4 = excluded.phone_last4,
                            phone_e164 = excluded.phone_e164,
                            last_synced_at = excluded.last_synced_at
                    `, [hash, displayName, phoneLast4, e164, Date.now()]);

                    syncPayload.push({ hash, displayName });
                }
            }

            // 6. Batch Sync with Backend (Privacy-First: Only send hashes)
            await this.performSync(syncPayload);

            localStorage.setItem('last_contact_sync', Date.now().toString());
            this.logger.log('[ContactResolver] Sync completed successfully.');

        } catch (err) {
            this.logger.error('[ContactResolver] Sync Failed', err);
        } finally {
            this.isSyncingSubject.next(false);
        }
    }

    /**
     * Returns contacts split into registered (on ChatFlect) and unregistered (invite).
     * Registered contacts are sorted alphabetically with device address book names.
     */
    async getResolvedContacts(): Promise<ResolvedContactsResult> {
        await this.localDb.readyPromise;

        const myId = localStorage.getItem('user_id');

        const all: ResolvedContact[] = await this.localDb.query(`
            SELECT hash, display_name, server_name, phone_last4, phone_e164, 
                   user_id, status, photo_url, short_note, last_synced_at
            FROM local_contacts 
            ORDER BY display_name ASC
        `);

        // Filter out self
        const filtered = all.filter(c => c.user_id !== myId);

        const registered = filtered
            .filter(c => c.status === 'on_chatflect' && c.user_id)
            .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

        const unregistered = filtered
            .filter(c => c.status !== 'on_chatflect' || !c.user_id)
            .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

        return { registered, unregistered };
    }

    /**
     * Helper for legacy components that expect a flat array of all contacts
     */
    async getAllResolvedContactsAsArray(): Promise<ResolvedContact[]> {
        const result = await this.getResolvedContacts();
        return [...result.registered, ...result.unregistered];
    }

    /**
     * Global Search for users not in local contacts
     */
    async searchGlobal(query: string): Promise<any[]> {
        try {
            const res: any = await this.http.post(`${environment.apiUrl}/contacts.php`, {
                query
            }, { withCredentials: true }).toPromise();
            return Array.isArray(res) ? res : [];
        } catch (e) {
            this.logger.error('[ContactResolver] Global Search Failed', e);
            return [];
        }
    }

    /* ================================
       PRIVATE: Phone Normalization
    ================================= */

    private normalizePhoneNumber(phone: string): string | null {
        try {
            const phoneNumber = parsePhoneNumberFromString(phone, this.DEFAULT_REGION as any);
            return phoneNumber && phoneNumber.isValid() ? phoneNumber.format('E.164') : null;
        } catch (e) {
            return null;
        }
    }

    /* ================================
       PRIVATE: ZK-S Hashing
    ================================= */

    private async loadSalt(): Promise<void> {
        if (this.deviceSalt) return;
        const userId = localStorage.getItem('user_id');
        if (userId) {
            this.deviceSalt = await this.auth.getOrFetchContactSalt(userId);
        }
    }

    /**
     * SHA-256(salt + E.164 phone). If no salt available, falls back to SHA-256(phone).
     * Never sends raw phone numbers to the server.
     */
    private async hashPhone(e164: string): Promise<string> {
        const input = this.deviceSalt ? (this.deviceSalt + e164) : e164;
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /* ================================
       PRIVATE: Backend Sync
    ================================= */

    private async performSync(payload: { hash: string; displayName: string }[]): Promise<void> {
        if (payload.length === 0) return;

        // Batch into chunks to stay within PHP/POST limits
        const chunkSize = 100;
        for (let i = 0; i < payload.length; i += chunkSize) {
            const chunk = payload.slice(i, i + chunkSize);
            const hashes = chunk.map(c => c.hash);

            // HF-4.3: Replay Protection Parameters
            const timestamp = Date.now();
            const nonce = window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);

            try {
                const response: any = await this.http.post(`${environment.apiUrl}/contacts/map.php`, {
                    hashes,
                    device_uuid: localStorage.getItem('device_uuid'),
                    timestamp: timestamp,
                    nonce: nonce
                }, { withCredentials: true }).toPromise();

                if (response && response.success && Array.isArray(response.matches)) {
                    for (const match of response.matches) {
                        // Update local contact with server data
                        await this.localDb.run(`
                            UPDATE local_contacts 
                            SET user_id = ?, photo_url = ?, server_name = ?, short_note = ?, status = 'on_chatflect'
                            WHERE hash = ?
                        `, [
                            match.user_id,
                            match.photo_url || null,
                            match.server_name || null,
                            match.short_note || null,
                            match.hash
                        ]);
                    }
                    this.logger.log(`[ContactResolver] Batch matched ${response.matches.length} users.`);
                }
            } catch (e) {
                this.logger.error('[ContactResolver] Batch sync failed', e);
            }
        }
    }
}
