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
    private isInitialized: boolean = false;
    private isProcessing = false;
    private currentOperationId = 0;
    private initPromise: Promise<void> | null = null;
    private mode: 'persistent' | 'ephemeral' | 'none' = 'none';
    private fatal = false; // Track fatal state

    private readonly DB_NAME = 'chatflect_cache_v9'; // v9: Force reset for encryption migration

    constructor() {
        // Strict singleton call
        this.initDatabase();
    }

    /**
     * Wait for database initialization before running queries
     * MUST NEVER THROW to avoid global unhandled exceptions.
     */
    /**
     * Public readiness check (v15.2)
     */
    async isReady(): Promise<boolean> {
        if (this.isInitialized) return true;
        if (this.initPromise) {
            try { await this.initPromise; } catch (e) { }
        }
        return this.isInitialized;
    }



    private async safeRun(statement: string, values: any[] = []): Promise<any> {
        if (!(await this.isReady())) {
            console.warn('[StorageService][SafeMode] Run skipped');
            return null;
        }
        return this.db.run(statement, values);
    }

    private async safeQuery<T = any>(statement: string, values: any[] = []): Promise<T[]> {
        if (!(await this.isReady())) {
            console.warn('[StorageService][SafeMode] Query skipped');
            return [];
        }
        const res = await this.db.query(statement, values);
        return (res.values as T[]) || [];
    }

    private async safeExecute(statements: string): Promise<any> {
        if (!(await this.isReady())) {
            console.warn('[StorageService][SafeMode] Execute skipped');
            return null;
        }
        return this.db.execute(statements);
    }

    async initDatabase(): Promise<void> {
        // 3. Strict Singleton Pattern
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            // 1. Try Persistent Mode
            try {
                await this.setupConnection({ ephemeral: false }); // persistent
                this.mode = 'persistent';
                this.isInitialized = true;
                console.log('[StorageService][v9] SQLite Database Initialized (Persistent)');

                await this.postInitSetup();
                return; // ✅ Success
            } catch (e1) {
                console.warn('[StorageService][v9] Persistent Init Failed - Attempting Fallback', e1);

                // 2. Fallback to Ephemeral Mode (Reset DB + Ephemeral Key)
                try {
                    await this.safeDeleteDb();

                    // True ephemeral fallback: In-memory key only. Bypasses SecureStorage.
                    await this.setupConnection({ ephemeral: true });
                    this.mode = 'ephemeral';
                    this.isInitialized = true;
                    console.info('[StorageService][v9] SQLite Database Initialized (Ephemeral/Reset)'); // INFO level

                    await this.postInitSetup();
                    return; // ✅ Success - DO NOT THROW
                } catch (e2) {
                    console.error('[StorageService][v9] Fatal Init Error (Ephemeral Failed)', e2);
                    this.mode = 'none';
                    this.isInitialized = false;
                    this.fatal = true; // Mark as fatal
                    // DO NOT THROW. Let isReady handle it.
                }
            }
        })();

        return this.initPromise;
    }

    private async setupConnection(options: { ephemeral: boolean }) {
        let passphrase: string;

        if (options.ephemeral) {
            // Generate random in-memory key. Do NOT save to SecureStorage.
            passphrase = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));
            console.log('[StorageService] Using Ephemeral Key');
        } else {
            // Retrieve or create persistent key
            passphrase = await this.getOrCreatePassphrase();
        }

        this.db = await this.sqlite.createConnection(
            this.DB_NAME,
            true,
            'secret',
            1,
            false
        );
        await this.db.open();
        await (this.db as any).setEncryptionSecret(passphrase);
        await this.createTables();
    }

    private async safeDeleteDb() {
        try {
            if (this.sqlite) {
                await this.sqlite.closeConnection(this.DB_NAME, false).catch(() => { });
            }
            await CapacitorSQLite.deleteDatabase({ database: this.DB_NAME }).catch(() => { });
        } catch (e) {
            console.warn('[StorageService] Delete DB warning', e);
        }
    }

    private async postInitSetup() {
        // Validate Integrity (v14)
        await this.runHealthCheck();

        // v15 Migration
        try {
            await this.db.execute('ALTER TABLE media_cache ADD COLUMN last_used INTEGER');
        } catch (e) { }

        this.pruneMessageCache();
        this.enforceMediaCacheLimit(200);
    }

    private async getOrCreatePassphrase(): Promise<string> {
        try {
            const { value } = await SecureStoragePlugin.get({ key: 'sqlite_passphrase' });
            if (value) return value;
        } catch (e) {
            // Not found or error reading
        }

        const newPass = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));
        try {
            await SecureStoragePlugin.set({ key: 'sqlite_passphrase', value: newPass });
        } catch (e) {
            console.error('[StorageService] SecureStorage Set Failed - Using ephemeral passphrase', e);
            // Fallback: Return newPass anyway. DB will work for this session, but will need reset next time.
            // This is better than crashing.
        }
        return newPass;
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
        await this.db.execute(queries);
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

    // --- Message Caching ---

    async saveMessages(chatId: string, messages: any[]) {
        for (const msg of messages) {
            // We only store permanent messages (not system signals or revoked unless needed)
            if (msg.type === 'revoked') continue;

            await this.safeRun(
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
        const values = await this.safeQuery('SELECT payload FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chatId]);
        return values.map((v: any) => JSON.parse(v.payload));
    }

    // --- Contacts Caching ---

    async saveContacts(contacts: any[]) {
        const now = Date.now();
        for (const contact of contacts) {
            await this.safeRun(
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
        const values = await this.safeQuery('SELECT public_key FROM contacts WHERE user_id = ?', [userId]);
        if (values.length > 0) {
            return values[0].public_key;
        }
        return null;
    }

    async savePublicKey(userId: string, key: string) {
        await this.safeRun('UPDATE contacts SET public_key = ? WHERE user_id = ?', [key, userId]);
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
            return values[0];
        }
        return null;
    }

    async saveMediaCache(url: string, blobPath: string, mime: string) {
        await this.safeRun(
            'INSERT OR REPLACE INTO media_cache (url, blob_path, mime, updated_at, last_verified_at, verification_status, last_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [url, blobPath, mime, Date.now(), Date.now(), 'verified', Date.now()]
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
            console.log(`[StorageService][v15] Enforcing Cache Limit: ${limitMB}MB`);

            // 1. Calculate Total Size
            // Note: Does not check actual file sizes, estimates or relies on Page Size would be better. 
            // For v15, we'll assume average 1MB or rely on count, but let's try to query FS stats if possible?
            // Expensive. Better strategy: Count-based or just purge oldest if *count* is high?
            // "Size-based logs" requested. Let's use SQLite to approximate or Filesystem loop.
            // Fast approach: Check total items. If > 500, purge.
            // Better approach (requested): "Calculate total size".
            // We can sum file sizes? No SQL support for file size.
            // We will iterate ALL media? Too slow.
            // Hybrid: Pure LRU count for performance?
            // Plan said: "Calculate total size".

            // Let's rely on a rough count limit for performance (e.g. 500 items ~ 500MB+ for videos)
            // Or use byte size integration.
            // "Size-based limits matter more".
            // Okay, let's Iterate to sum sizes (limited to 50 samples to estimate avg?)
            // Or just check page_count again.
            // Let's implement an LRU Prune based on COUNT (e.g. 200 items) + Age.

            // User Requirement: "Size-based eviction".
            // Implementation:
            const { Filesystem, Directory } = await import('@capacitor/filesystem');

            const res = await this.db.query('SELECT url, blob_path, last_used FROM media_cache ORDER BY last_used ASC');
            if (!res.values) throw new Error('No values');

            let totalSize = 0;
            const items = [];

            // This Scan is heavy. Optimization: Store size in DB on save?
            // For now, scan.
            for (const row of res.values) {
                try {
                    const stat = await Filesystem.stat({ path: row.blob_path, directory: Directory.Cache });
                    items.push({ ...row, size: stat.size });
                    totalSize += stat.size;
                } catch (e) {
                    // File missing? Delete DB row later.
                    items.push({ ...row, size: 0, missing: true });
                }
            }

            const limitBytes = limitMB * 1024 * 1024;
            console.log(`[StorageService][v15] Current Usage: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

            if (totalSize > limitBytes) {
                let currentSize = totalSize;
                const toDelete = [];

                // Items are ordered ASC (Oldest first)
                for (const item of items) {
                    if (currentSize <= limitBytes) break;
                    toDelete.push(item);
                    currentSize -= item.size;
                }

                console.log(`[StorageService][v15] Evicting ${toDelete.length} items to reclaim ${(totalSize - currentSize) / 1024 / 1024} MB`);

                await this.db.execute('BEGIN TRANSACTION');
                for (const item of toDelete) {
                    try {
                        if (!item.missing) {
                            await Filesystem.deleteFile({ path: item.blob_path, directory: Directory.Cache });
                        }
                        await this.db.run('DELETE FROM media_cache WHERE url = ?', [item.url]);
                    } catch (e) { }
                }
                await this.db.execute('COMMIT');
            }

        } catch (e) {
            console.error('[StorageService][v15] Eviction Error', e);
            await this.db.execute('ROLLBACK').catch(() => { });
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
                console.log(`[StorageService][v8] Pruned ${values.length} items (Op ${opId})`);
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
        // Safe run handles guard
        try {
            const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
            const expiry = Date.now() - ttlMs;

            const res = await this.safeRun(
                'DELETE FROM messages WHERE timestamp < ? AND is_starred = 0',
                [expiry]
            );
            if (res && res.changes && res.changes.changes > 0) {
                console.log(`[StorageService][v9] Pruned ${res.changes.changes} old messages.`);
            }
        } catch (e) {
            console.error('[StorageService][v9] Prune messages failed', e);
        }
    }

    // --- Search (v16) ---
    async searchMessages(query: string, limit: number = 50): Promise<any[]> {
        const term = `%${query}%`;
        // Search in JSON payload
        const values = await this.safeQuery(
            'SELECT payload FROM messages WHERE payload LIKE ? ORDER BY timestamp DESC LIMIT ?',
            [term, limit]
        );
        return values.map((v: any) => JSON.parse(v.payload));
    }

    // --- Outbox Management (v9) ---

    async addToOutbox(chatId: string, action: 'send' | 'edit' | 'delete', payload: any) {
        const id = `out_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
                        await this.db.run('DELETE FROM media_cache WHERE url = ?', [row.url]);
                        await this.db.run('DELETE FROM media_retries WHERE url = ?', [row.url]);
                        totalHealed++;
                    }
                }
                await this.db.execute('COMMIT');

                if (values.length < batchSize) break;
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
        const values = await this.safeQuery('SELECT * FROM media_retries WHERE url = ?', [url]);
        return values.length > 0 ? values[0] : null;
    }

    async saveMediaRetry(url: string, count: number, nextRetry: number, lastLogged: number) {
        try {
            await this.safeRun('INSERT OR REPLACE INTO media_retries (url, count, next_retry, last_logged) VALUES (?, ?, ?, ?)',
                [url, count, nextRetry, lastLogged]);
        } catch (e) { }
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
}
