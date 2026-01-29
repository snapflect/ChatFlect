import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
    private db!: SQLiteDBConnection;
    private isInitialized = false;
    private isProcessing = false;
    private currentOperationId = 0;

    private readonly DB_NAME = 'chatflect_cache_v9'; // v9: Force reset for encryption migration

    constructor() {
        this.initDatabase();
    }

    async initDatabase() {
        if (this.isInitialized) return;

        try {
            const passphrase = await this.getOrCreatePassphrase();

            this.db = await this.sqlite.createConnection(
                this.DB_NAME,
                true, // encrypted (v9)
                'secret', // mode
                1,
                false
            );

            await this.db.open();
            await (this.db as any).setEncryptionSecret(passphrase);

            await this.createTables();
            this.isInitialized = true;
            console.log('[StorageService][v9] SQLite Database Initialized (Encrypted)');

            // Validate Integrity (v14)
            await this.runHealthCheck();

            // Trigger background maintenance
            this.pruneMessageCache();
        } catch (e) {
            console.error('[StorageService][v9] SQLite Init Error', e);
            // Fallback: If encryption fails due to key mismatch (rare), we may need to reset
            // Strategy: For v9 audit, we transitioned to a new DB_NAME to avoid complex re-encryption logic
        }
    }

    private async getOrCreatePassphrase(): Promise<string> {
        try {
            const { value } = await SecureStoragePlugin.get({ key: 'sqlite_passphrase' });
            return value;
        } catch (e) {
            // Not found, create new
            const newPass = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));
            await SecureStoragePlugin.set({ key: 'sqlite_passphrase', value: newPass });
            return newPass;
        }
    }

    private async createTables() {
        const queries = `
      CREATE TABLE IF NOT EXISTS contacts (
        user_id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        phone_number TEXT,
        email TEXT,
        photo_url TEXT,
        public_key TEXT,
        last_seen INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS discovery_cache (
        query TEXT PRIMARY KEY,
        results TEXT,
        expires_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS meta_cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT,
        sender_id TEXT,
        type TEXT,
        payload TEXT,
        timestamp INTEGER,
        expires_at INTEGER,
        is_starred INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_msg_chat ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_msg_ts ON messages(timestamp);

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        data TEXT,
        last_timestamp INTEGER
      );

      CREATE TABLE IF NOT EXISTS media_cache (
        url TEXT PRIMARY KEY,
        blob_path TEXT,
        mime TEXT,
        updated_at INTEGER,
        last_verified_at INTEGER,
        verification_status TEXT DEFAULT 'verified'
      );
      CREATE TABLE IF NOT EXISTS media_retries (
        url TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        next_retry INTEGER,
        last_logged INTEGER
      );

      -- Persistent Outbox for Offline Sync (v9)
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        chat_id TEXT,
        action TEXT, -- 'send', 'edit', 'delete'
        payload TEXT,
        timestamp INTEGER,
        retry_count INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_chat ON outbox(chat_id);
    `;
        await this.db.execute(queries);
    }

    // --- Chat List Caching ---

    async saveChats(chats: any[]) {
        await this.waitForInit();
        for (const chat of chats) {
            await this.db.run(
                'INSERT OR REPLACE INTO chats (id, data, last_timestamp) VALUES (?, ?, ?)',
                [chat.id, JSON.stringify(chat), chat.lastTimestamp || 0]
            );
        }
    }

    async getCachedChats() {
        await this.waitForInit();
        const res = await this.db.query('SELECT data FROM chats ORDER BY last_timestamp DESC');
        return (res.values || []).map(v => JSON.parse(v.data));
    }

    // --- Message Caching ---

    async saveMessages(chatId: string, messages: any[]) {
        await this.waitForInit();
        for (const msg of messages) {
            // We only store permanent messages (not system signals or revoked unless needed)
            if (msg.type === 'revoked') continue;

            await this.db.run(
                `INSERT OR REPLACE INTO messages (id, chat_id, sender_id, type, payload, timestamp, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    msg.id,
                    chatId,
                    msg.senderId,
                    msg.type,
                    JSON.stringify(msg), // Store full decoded payload for instant display
                    msg.timestamp,
                    msg.expiresAt || null
                ]
            );
        }
    }

    async getCachedMessages(chatId: string) {
        await this.waitForInit();
        const res = await this.db.query('SELECT payload FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
        return (res.values || []).map(v => JSON.parse(v.payload));
    }

    // --- Contacts Caching ---

    async saveContacts(contacts: any[]) {
        await this.waitForInit();
        const now = Date.now();
        for (const contact of contacts) {
            await this.db.run(
                `INSERT OR REPLACE INTO contacts (user_id, first_name, last_name, phone_number, email, photo_url, public_key, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    contact.user_id,
                    contact.first_name,
                    contact.last_name,
                    contact.phone_number,
                    contact.email,
                    contact.photo_url,
                    contact.public_key || null,
                    now
                ]
            );
        }
    }

    async getPublicKey(userId: string): Promise<string | null> {
        await this.waitForInit();
        const res = await this.db.query('SELECT public_key FROM contacts WHERE user_id = ?', [userId]);
        if (res.values && res.values.length > 0) {
            return res.values[0].public_key;
        }
        return null;
    }

    async savePublicKey(userId: string, key: string) {
        await this.waitForInit();
        await this.db.run('UPDATE contacts SET public_key = ? WHERE user_id = ?', [key, userId]);
    }

    async getCachedContacts() {
        await this.waitForInit();
        const res = await this.db.query('SELECT * FROM contacts ORDER BY first_name ASC');
        return res.values || [];
    }

    // --- Meta Cache (Generic K/V) ---

    async setMeta(key: string, value: any) {
        await this.waitForInit();
        await this.db.run(
            'INSERT OR REPLACE INTO meta_cache (key, value, updated_at) VALUES (?, ?, ?)',
            [key, JSON.stringify(value), Date.now()]
        );
    }

    async getMeta(key: string) {
        await this.waitForInit();
        const res = await this.db.query('SELECT value FROM meta_cache WHERE key = ?', [key]);
        if (res.values && res.values.length > 0) {
            return JSON.parse(res.values[0].value);
        }
        return null;
    }

    async getMediaCache(url: string) {
        await this.waitForInit();
        const res = await this.db.query('SELECT * FROM media_cache WHERE url = ?', [url]);
        if (res.values && res.values.length > 0) {
            return res.values[0];
        }
        return null;
    }

    async saveMediaCache(url: string, blobPath: string, mime: string) {
        await this.waitForInit();
        await this.db.run(
            'INSERT OR REPLACE INTO media_cache (url, blob_path, mime, updated_at, last_verified_at, verification_status) VALUES (?, ?, ?, ?, ?, ?)',
            [url, blobPath, mime, Date.now(), Date.now(), 'verified']
        );
    }

    async updateVerificationStatus(url: string, status: 'verified' | 'unverified') {
        await this.waitForInit();
        await this.db.run(
            'UPDATE media_cache SET verification_status = ?, last_verified_at = ? WHERE url = ?',
            [status, Date.now(), url]
        );
    }

    // --- Cache Eviction & Purging (v3 Refined) ---

    async pruneMediaCache(ttlDays: number = 7) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const opId = ++this.currentOperationId;

        await this.waitForInit();

        try {
            const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
            const expiry = Date.now() - ttlMs;

            const res = await this.db.query('SELECT url, blob_path FROM media_cache WHERE updated_at < ?', [expiry]);

            if (res.values && res.values.length > 0) {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');

                // Start Transaction for Atomicity
                await this.db.execute('BEGIN TRANSACTION');

                for (const row of res.values) {
                    if (this.currentOperationId !== opId) {
                        console.warn(`[StorageService][v9] Prune (Op ${opId}) canceled by Op ${this.currentOperationId}`);
                        await this.db.execute('ROLLBACK');
                        return;
                    }

                    try {
                        await Filesystem.deleteFile({
                            path: row.blob_path,
                            directory: Directory.Cache
                        });
                        await this.db.run('DELETE FROM media_cache WHERE url = ?', [row.url]);
                        await this.db.run('DELETE FROM media_retries WHERE url = ?', [row.url]);
                    } catch (e) {
                        const err = e as any;
                        const normErr = this.normalizeError(err);

                        if (normErr === 'ERROR_FILE_NOT_FOUND') {
                            await this.db.run('DELETE FROM media_cache WHERE url = ?', [row.url]);
                            await this.db.run('DELETE FROM media_retries WHERE url = ?', [row.url]);
                        } else {
                            console.error(`[StorageService][v8] Prune Fail (Op ${opId}): Path=${this.redactPath(row.blob_path)}, Code=${normErr}`);
                        }
                    }
                }

                await this.db.execute('COMMIT');
                console.log(`[StorageService][v8] Pruned ${res.values.length} items (Op ${opId})`);
            }
        } catch (err) {
            console.error(`[StorageService][v8] Prune Exception (Op ${opId})`, err);
            await this.db.execute('ROLLBACK').catch(() => { });
        } finally {
            if (this.currentOperationId === opId) {
                this.isProcessing = false;
            }
        }
    }

    /**
     * pruneMessageCache (v9): Delete old messages not marked as starred.
     */
    async pruneMessageCache(ttlDays: number = 14) {
        await this.waitForInit();
        try {
            const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
            const expiry = Date.now() - ttlMs;

            const res = await this.db.run(
                'DELETE FROM messages WHERE timestamp < ? AND is_starred = 0',
                [expiry]
            );
            if (res.changes && res.changes.changes && res.changes.changes > 0) {
                console.log(`[StorageService][v9] Pruned ${res.changes.changes} old messages.`);
            }
        } catch (e) {
            console.error('[StorageService][v9] Prune messages failed', e);
        }
    }

    // --- Outbox Management (v9) ---

    async addToOutbox(chatId: string, action: 'send' | 'edit' | 'delete', payload: any) {
        await this.waitForInit();
        const id = `out_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await this.db.run(
            'INSERT INTO outbox (id, chat_id, action, payload, timestamp) VALUES (?, ?, ?, ?, ?)',
            [id, chatId, action, JSON.stringify(payload), Date.now()]
        );
        return id;
    }

    async getOutbox() {
        await this.waitForInit();
        const res = await this.db.query('SELECT * FROM outbox ORDER BY timestamp ASC');
        return (res.values || []).map(v => ({
            ...v,
            payload: JSON.parse(v.payload)
        }));
    }

    async removeFromOutbox(id: string) {
        await this.waitForInit();
        await this.db.run('DELETE FROM outbox WHERE id = ?', [id]);
    }

    async incrementOutboxRetry(id: string) {
        await this.waitForInit();
        await this.db.run('UPDATE outbox SET retry_count = retry_count + 1 WHERE id = ?', [id]);
    }

    async purgeAllMediaCache() {
        const opId = ++this.currentOperationId; // Incrementing cancels any active prune
        this.isProcessing = true;
        await this.waitForInit();

        try {
            const res = await this.db.query('SELECT url, blob_path FROM media_cache');
            const { Filesystem, Directory } = await import('@capacitor/filesystem');

            await this.db.execute('BEGIN TRANSACTION');

            if (res.values) {
                for (const row of res.values) {
                    try {
                        await Filesystem.deleteFile({
                            path: row.blob_path,
                            directory: Directory.Cache
                        });
                    } catch (e) {
                        const err = e as any;
                        if (this.normalizeError(err) !== 'ERROR_FILE_NOT_FOUND') {
                            console.error(`[StorageService][v8] Purge File Fail: ${this.redactPath(row.blob_path)}`, err);
                        }
                    }
                    await this.db.run('DELETE FROM media_cache WHERE url = ?', [row.url]);
                    await this.db.run('DELETE FROM media_retries WHERE url = ?', [row.url]);
                }
            }

            await this.db.execute('COMMIT');
            console.log(`[StorageService][v8] Media cache purged completely (Op ${opId})`);
        } catch (err) {
            console.error(`[StorageService][v8] Purge failed (Op ${opId})`, err);
            await this.db.execute('ROLLBACK').catch(() => { });
        } finally {
            if (this.currentOperationId === opId) {
                this.isProcessing = false;
            }
        }
    }

    /**
     * Reconciliation Sweep (v8 Definitive): Batched healing of DB-disk mismatches
     */
    async reconcileCache() {
        await this.waitForInit();
        const batchSize = 50;
        let offset = 0;
        let totalHealed = 0;

        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        console.log(`[StorageService][v8] Starting batched reconciliation...`);

        try {
            while (true) {
                const res = await this.db.query(`SELECT url, blob_path FROM media_cache LIMIT ${batchSize} OFFSET ${offset}`);
                if (!res.values || res.values.length === 0) break;

                await this.db.execute('BEGIN TRANSACTION');
                for (const row of res.values) {
                    try {
                        await Filesystem.stat({
                            path: row.blob_path,
                            directory: Directory.Cache
                        });
                    } catch (e) {
                        await this.db.run('DELETE FROM media_cache WHERE url = ?', [row.url]);
                        await this.db.run('DELETE FROM media_retries WHERE url = ?', [row.url]);
                        totalHealed++;
                    }
                }
                await this.db.execute('COMMIT');

                if (res.values.length < batchSize) break;
                offset += batchSize;
            }

            if (totalHealed > 0) {
                console.log(`[StorageService][v8] Reconciliation complete: Healed ${totalHealed} mismatches.`);
            }
        } catch (err) {
            console.error(`[StorageService][v8] Reconciliation failed at offset ${offset}`, err);
            await this.db.execute('ROLLBACK').catch(() => { });
        }
    }

    // --- PERSISTENT RETRY HELPERS (v8) ---

    async getMediaRetry(url: string) {
        await this.waitForInit();
        const res = await this.db.query('SELECT * FROM media_retries WHERE url = ?', [url]);
        return res.values && res.values.length > 0 ? res.values[0] : null;
    }

    async saveMediaRetry(url: string, count: number, nextRetry: number, lastLogged: number) {
        await this.waitForInit();
        try {
            await this.db.run('INSERT OR REPLACE INTO media_retries (url, count, next_retry, last_logged) VALUES (?, ?, ?, ?)',
                [url, count, nextRetry, lastLogged]);
        } catch (e) { }
    }

    async deleteMediaRetry(url: string) {
        await this.waitForInit();
        await this.db.run('DELETE FROM media_retries WHERE url = ?', [url]);
    }

    // --- AUDIT TOOLS ---

    private redactPath(path: string): string {
        if (!path) return 'unknown';
        return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '***-ID-***');
    }

    private normalizeError(err: any): string {
        const msg = (err.message || '').toLowerCase();
        const code = (err.code || '').toString().toUpperCase();

        if (msg.includes('not found') || code === 'ENOENT' || code === '1' || code === '0X80070002') {
            return 'ERROR_FILE_NOT_FOUND';
        }
        if (msg.includes('permission') || code === 'EACCES' || code === '0X80070005') {
            return 'ERROR_ACCESS_DENIED';
        }
        if (code === 'EIO' || msg.includes('input/output')) {
            return 'ERROR_IO_FAILURE';
        }
        return `ERROR_UNKNOWN(${code})`;
    }

    async runHealthCheck() {
        try {
            console.log('[StorageService][v14] Running Integrity Check...');
            const res = await this.db.query('PRAGMA integrity_check');
            const result = res.values && res.values.length > 0 ? Object.values(res.values[0])[0] : 'unknown';

            if (result !== 'ok') {
                console.error('[StorageService][v14] CORRUPTION DETECTED:', result);
                // Attempt VACUUM to rebuild
                await this.db.execute('VACUUM');
                console.log('[StorageService][v14] VACUUM completed. Re-checking...');

                const res2 = await this.db.query('PRAGMA integrity_check');
                const result2 = res2.values && res2.values.length > 0 ? Object.values(res2.values[0])[0] : 'unknown';

                if (result2 !== 'ok') {
                    console.error('[StorageService][v14] FATAL: VACUUM failed. Database may be unsafe.');
                    // In a real app, might flag for wipe. 
                    // For v14: Log and warn.
                }
            } else {
                console.log('[StorageService][v14] Integrity Check Passed (ok)');

                // Optional: Log Size
                const sizeRes = await this.db.query('PRAGMA page_count');
                const pageSizeRes = await this.db.query('PRAGMA page_size');
                if (sizeRes.values && pageSizeRes.values) {
                    const size = (Object.values(sizeRes.values[0])[0] as number) * (Object.values(pageSizeRes.values[0])[0] as number);
                    console.log(`[StorageService][v14] DB Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
                }
            }
        } catch (e) {
            console.error('[StorageService] Integrity Check Exception', e);
        }
    }

    private async waitForInit() {
        let attempts = 0;
        while (!this.isInitialized && attempts < 20) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }
    }
}
