import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private isProcessing = false;
    private currentOperationId = 0;

    constructor(private localDb: LocalDbService) {
        // v2.3: Redundant initDatabase removed as LocalDbService handles it in APP_INITIALIZER
    }

    /**
     * Public readiness check (v15.2)
     */
    async isReady(): Promise<boolean> {
        await this.localDb.initialize();
        await this.createTables(); // v5F: Ensure media tables exist
        return true;
    }

    private async safeRun(statement: string, values: any[] = []): Promise<any> {
        return this.localDb.run(statement, values);
    }

    private async safeQuery<T = any>(statement: string, values: any[] = []): Promise<T[]> {
        return this.localDb.query<T>(statement, values);
    }

    private async safeExecute(statements: string): Promise<any> {
        return this.localDb.execute(statements);
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
        fetched_at INTEGER, -- v16.0: TTL for E2EE keys
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



      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        data TEXT,
        last_timestamp INTEGER
      );

      CREATE TABLE IF NOT EXISTS media_cache (
        url TEXT PRIMARY KEY,
        blob_path TEXT,
        mime TEXT,
        file_size INTEGER DEFAULT 0, -- v5F: For efficient eviction
        updated_at INTEGER,
        last_verified_at INTEGER,
        verification_status TEXT DEFAULT 'verified',
        last_used INTEGER -- v15 LRU
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
        await this.safeExecute(queries);
    }

    // --- Chat List Caching ---

    async saveChats(chats: any[]) {
        for (const chat of chats) {
            await this.safeRun(
                'INSERT OR REPLACE INTO chats (id, data, last_timestamp) VALUES (?, ?, ?)',
                [chat.id, JSON.stringify(chat), chat.lastTimestamp || 0]
            );
        }
    }

    async getCachedChats() {
        const values = await this.safeQuery('SELECT data FROM chats ORDER BY last_timestamp DESC');
        return values.map((v: any) => JSON.parse(v.data));
    }



    // --- Contacts Caching ---

    async saveContacts(contacts: any[]) {
        const now = Date.now();
        for (const contact of contacts) {
            await this.safeRun(
                `INSERT OR REPLACE INTO contacts (user_id, first_name, last_name, phone_number, email, photo_url, public_key, updated_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    contact.user_id,
                    contact.first_name,
                    contact.last_name,
                    contact.phone_number,
                    contact.email,
                    contact.photo_url,
                    contact.public_key || null,
                    now,
                    contact.public_key ? now : null
                ]
            );
        }
    }

    async getPublicKey(userId: string): Promise<{ key: string, fetchedAt: number } | null> {
        const normalizedId = String(userId).trim().toUpperCase();
        const values = await this.safeQuery('SELECT public_key, fetched_at FROM contacts WHERE user_id = ?', [normalizedId]);
        if (values.length > 0 && values[0].public_key) {
            return {
                key: values[0].public_key,
                fetchedAt: values[0].fetched_at || 0
            };
        }
        return null;
    }

    async savePublicKey(userId: string, key: string) {
        const normalizedId = String(userId).trim().toUpperCase();
        const now = Date.now();
        // Use Insert or Replace to ensure the entry exists even if not in contacts yet
        await this.safeRun(
            'INSERT INTO contacts (user_id, public_key, fetched_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET public_key=excluded.public_key, fetched_at=excluded.fetched_at, updated_at=excluded.updated_at',
            [normalizedId, key, now, now]
        );
    }

    async getCachedContacts() {
        const values = await this.safeQuery('SELECT * FROM contacts ORDER BY first_name ASC');
        return values || [];
    }

    // --- Meta Cache (Generic K/V) ---

    async setMeta(key: string, value: any) {
        await this.safeRun(
            'INSERT OR REPLACE INTO meta_cache (key, value, updated_at) VALUES (?, ?, ?)',
            [key, JSON.stringify(value), Date.now()]
        );
    }

    async getMeta(key: string) {
        const values = await this.safeQuery('SELECT value FROM meta_cache WHERE key = ?', [key]);
        if (values.length > 0) {
            return JSON.parse(values[0].value);
        }
        return null;
    }

    async getMediaCache(url: string) {
        const values = await this.safeQuery('SELECT * FROM media_cache WHERE url = ?', [url]);
        if (values.length > 0) {
            // Update last_used asyc-ly (don't block read)
            this.safeRun('UPDATE media_cache SET last_used = ? WHERE url = ?', [Date.now(), url]).catch(() => { });
            return values[0];
        }
        return null;
    }

    async saveMediaCache(url: string, blob_path: string, mime: string, size: number = 0) {
        await this.safeRun(
            'INSERT OR REPLACE INTO media_cache (url, blob_path, mime, file_size, updated_at, last_verified_at, verification_status, last_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [url, blob_path, mime, size, Date.now(), Date.now(), 'verified', Date.now()]
        );
    }

    /**
     * Enforce LRU Cache Limit (v15)
     */
    async enforceMediaCacheLimit(limitMB: number = 200) {
        if (!(await this.isReady())) return;
        if (this.isProcessing) return;
        this.isProcessing = true;
        const opId = ++this.currentOperationId;

        try {
            console.log(`[StorageService][v5F] Enforcing Cache Limit: ${limitMB}MB`);

            const limitBytes = limitMB * 1024 * 1024;

            // 1. Calculate Total Size using DB (Definitive Phase 5F optimization)
            const stats = await this.safeQuery('SELECT SUM(file_size) as total FROM media_cache');
            const totalSize = stats[0]?.total || 0;

            console.log(`[StorageService][v5F] Current Usage (DB): ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

            if (totalSize > limitBytes) {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');

                // 2. Fetch items to delete (Oldest first)
                const toDelete = await this.safeQuery('SELECT url, blob_path, file_size FROM media_cache ORDER BY last_used ASC');

                let currentTotal = totalSize;
                let deletedCount = 0;

                await this.safeExecute('BEGIN TRANSACTION');
                for (const item of toDelete) {
                    if (currentTotal <= limitBytes) break;

                    try {
                        await Filesystem.deleteFile({ path: item.blob_path, directory: Directory.Cache });
                    } catch (e) {
                        // Even if file missing, we remove DB row
                    }

                    await this.safeRun('DELETE FROM media_cache WHERE url = ?', [item.url]);
                    await this.safeRun('DELETE FROM media_retries WHERE url = ?', [item.url]);

                    currentTotal -= item.file_size;
                    deletedCount++;
                }
                await this.safeExecute('COMMIT');

                console.log(`[StorageService][v5F] Evicted ${deletedCount} items. New usage: ${(currentTotal / 1024 / 1024).toFixed(2)} MB`);
            }

        } catch (e) {
            console.error('[StorageService][v5F] Eviction Error', e);
            await this.safeExecute('ROLLBACK').catch(() => { });
        } finally {
            if (this.currentOperationId === opId) this.isProcessing = false;
        }
    }

    async updateVerificationStatus(url: string, status: 'verified' | 'unverified') {
        await this.safeRun(
            'UPDATE media_cache SET verification_status = ?, last_verified_at = ? WHERE url = ?',
            [status, Date.now(), url]
        );
    }

    // --- Cache Eviction & Purging (v3 Refined) ---

    async pruneMediaCache(ttlDays: number = 7) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const opId = ++this.currentOperationId;

        if (!(await this.isReady())) {
            console.warn('[StorageService][SafeMode] Prune Media skipped');
            this.isProcessing = false;
            return;
        }

        try {
            const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
            const expiry = Date.now() - ttlMs;

            const values = await this.safeQuery('SELECT url, blob_path FROM media_cache WHERE updated_at < ?', [expiry]);

            if (values.length > 0) {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');

                // Start Transaction for Atomicity
                await this.safeExecute('BEGIN TRANSACTION');

                for (const row of values) {
                    if (this.currentOperationId !== opId) {
                        console.warn(`[StorageService][v9] Prune (Op ${opId}) canceled by Op ${this.currentOperationId}`);
                        await this.safeExecute('ROLLBACK');
                        return;
                    }

                    try {
                        await Filesystem.deleteFile({
                            path: row.blob_path,
                            directory: Directory.Cache
                        });
                        await this.safeRun('DELETE FROM media_cache WHERE url = ?', [row.url]);
                        await this.safeRun('DELETE FROM media_retries WHERE url = ?', [row.url]);
                    } catch (e) {
                        const err = e as any;
                        const normErr = this.normalizeError(err);

                        if (normErr === 'ERROR_FILE_NOT_FOUND') {
                            await this.safeRun('DELETE FROM media_cache WHERE url = ?', [row.url]);
                            await this.safeRun('DELETE FROM media_retries WHERE url = ?', [row.url]);
                        } else {
                            console.error(`[StorageService][v8] Prune Fail (Op ${opId}): Path=${this.redactPath(row.blob_path)}, Code=${normErr}`);
                        }
                    }
                }

                await this.safeExecute('COMMIT');
                console.log(`[StorageService][v8] Pruned ${values.length} items (Op ${opId})`);
            }
        } catch (err) {
            console.error(`[StorageService][v8] Prune Exception (Op ${opId})`, err);
            await this.safeExecute('ROLLBACK').catch(() => { });
        } finally {
            if (this.currentOperationId === opId) {
                this.isProcessing = false;
            }
        }
    }





    // --- Outbox Management (v9) ---

    async addToOutbox(chatId: string, action: 'send' | 'edit' | 'delete', payload: any) {
        const id = window.crypto.randomUUID();
        await this.safeRun(
            'INSERT INTO outbox (id, chat_id, action, payload, timestamp) VALUES (?, ?, ?, ?, ?)',
            [id, chatId, action, JSON.stringify(payload), Date.now()]
        );
        return id;
    }

    async getOutbox() {
        const values = await this.safeQuery('SELECT * FROM outbox ORDER BY timestamp ASC');
        return values.map((v: any) => ({
            ...v,
            payload: JSON.parse(v.payload)
        }));
    }

    async removeFromOutbox(id: string) {
        await this.safeRun('DELETE FROM outbox WHERE id = ?', [id]);
    }

    async incrementOutboxRetry(id: string) {
        await this.safeRun('UPDATE outbox SET retry_count = retry_count + 1 WHERE id = ?', [id]);
    }

    async purgeAllMediaCache() {
        const opId = ++this.currentOperationId; // Incrementing cancels any active prune
        this.isProcessing = true;
        if (!(await this.isReady())) {
            this.isProcessing = false;
            return;
        }

        try {
            const values = await this.safeQuery('SELECT url, blob_path FROM media_cache');
            const { Filesystem, Directory } = await import('@capacitor/filesystem');

            await this.safeExecute('BEGIN TRANSACTION');

            if (values.length > 0) {
                for (const row of values) {
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
                    await this.safeRun('DELETE FROM media_cache WHERE url = ?', [row.url]);
                    await this.safeRun('DELETE FROM media_retries WHERE url = ?', [row.url]);
                }
            }

            await this.safeExecute('COMMIT');
            console.log(`[StorageService][v8] Media cache purged completely (Op ${opId})`);
        } catch (err) {
            console.error(`[StorageService][v8] Purge failed (Op ${opId})`, err);
            await this.safeExecute('ROLLBACK').catch(() => { });
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
        if (!(await this.isReady())) return;
        const batchSize = 50;
        let offset = 0;
        let totalHealed = 0;

        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        console.log(`[StorageService][v8] Starting batched reconciliation...`);

        try {
            while (true) {
                const values = await this.safeQuery(`SELECT url, blob_path FROM media_cache LIMIT ${batchSize} OFFSET ${offset}`);
                if (values.length === 0) break;

                await this.safeExecute('BEGIN TRANSACTION');
                for (const row of values) {
                    try {
                        await Filesystem.stat({
                            path: row.blob_path,
                            directory: Directory.Cache
                        });
                    } catch (e) {
                        await this.safeRun('DELETE FROM media_cache WHERE url = ?', [row.url]);
                        await this.safeRun('DELETE FROM media_retries WHERE url = ?', [row.url]);
                        totalHealed++;
                    }
                }
                await this.safeExecute('COMMIT');

                if (values.length < batchSize) break;
                offset += batchSize;
            }

            if (totalHealed > 0) {
                console.log(`[StorageService][v8] Reconciliation complete: Healed ${totalHealed} mismatches.`);
            }
        } catch (err) {
            console.error(`[StorageService][v8] Reconciliation failed at offset ${offset}`, err);
            await this.safeExecute('ROLLBACK').catch(() => { });
        }
    }

    // --- PERSISTENT RETRY HELPERS (v8) ---

    async getMediaRetry(url: string) {
        const values = await this.safeQuery('SELECT * FROM media_retries WHERE url = ?', [url]);
        return values.length > 0 ? values[0] : null;
    }

    async saveMediaRetry(url: string, count: number, nextRetry: number, lastLogged: number) {
        try {
            await this.safeRun('INSERT OR REPLACE INTO media_retries (url, count, next_retry, last_logged) VALUES (?, ?, ?, ?)',
                [url, count, nextRetry, lastLogged]);
        } catch { /* ignore retry save error */ }
    }

    async deleteMediaRetry(url: string) {
        await this.safeRun('DELETE FROM media_retries WHERE url = ?', [url]);
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
        if (!(await this.isReady())) return; // Guard
        try {
            console.log('[StorageService][v14] Running Integrity Check...');
            const values = await this.safeQuery('PRAGMA integrity_check');
            const result = values.length > 0 ? Object.values(values[0])[0] : 'unknown';

            if (result !== 'ok') {
                console.error('[StorageService][v14] CORRUPTION DETECTED:', result);
                // Attempt VACUUM to rebuild
                await this.safeExecute('VACUUM');
                console.log('[StorageService][v14] VACUUM completed. Re-checking...');

                const res2 = await this.localDb.query('PRAGMA integrity_check');
                const result2 = res2.length > 0 ? Object.values(res2[0])[0] : 'unknown';

                if (result2 !== 'ok') {
                    console.error('[StorageService][v14] FATAL: VACUUM failed. Database may be unsafe.');
                    // In a real app, might flag for wipe. 
                    // For v14: Log and warn.
                }
            } else {
                console.log('[StorageService][v14] Integrity Check Passed (ok)');

                // Optional: Log Size
                const sizeRes = await this.localDb.query('PRAGMA page_count');
                const pageSizeRes = await this.localDb.query('PRAGMA page_size');
                if (sizeRes.length > 0 && pageSizeRes.length > 0) {
                    const size = (Object.values(sizeRes[0])[0] as number) * (Object.values(pageSizeRes[0])[0] as number);
                    console.log(`[StorageService][v14] DB Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
                }
            }
        } catch (e) {
            console.error('[StorageService] Integrity Check Exception', e);
        }
    }
}
