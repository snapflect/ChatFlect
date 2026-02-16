import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { LoggingService } from './logging.service';

/**
 * LocalDbService (v2.2 Architecture)
 * Centralized lifecycle management for SQLite (WhatsApp-Style).
 * High-performance, encrypted, and offline-first backbone.
 */
@Injectable({
    providedIn: 'root'
})
export class LocalDbService {
    private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
    private db!: SQLiteDBConnection;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    private readonly DB_NAME = 'chatflect_v2_main';

    constructor(private logger: LoggingService) { }

    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const passphrase = await this.getOrCreatePassphrase();

                this.db = await this.sqlite.createConnection(
                    this.DB_NAME,
                    true, // encrypted
                    'secret', // secret type
                    1, // version
                    false // readOnly
                );

                // v2.3 Fix: Apply encryption secret before operations/open logic consistency
                await (this.db as any).setEncryptionSecret(passphrase);
                await this.db.open();

                await this.createTables();
                this.isInitialized = true;
                this.logger.log(`[LocalDb] Database ${this.DB_NAME} initialized with encryption.`);
            } catch (err) {
                this.logger.error("[LocalDb] Initialization Fatal Error", err);
                throw err;
            }
        })();

        return this.initPromise;
    }

    async getReady(): Promise<SQLiteDBConnection> {
        if (!this.isInitialized) await this.initialize();
        return this.db;
    }

    private async getOrCreatePassphrase(): Promise<string> {
        try {
            // 1. Check for Legacy Passphrase (Backward Compatibility for initial v2.3 Alpha)
            const legacy = await SecureStoragePlugin.get({ key: 'sqlite_v2_passphrase' }).catch(() => ({ value: null }));
            if (legacy.value) {
                this.logger.log("[LocalDb] Using legacy vault passphrase.");
                return legacy.value;
            }

            // 2. Hybrid Derivation Strategy (HF-2.1)
            let masterSeed = (await SecureStoragePlugin.get({ key: 'sqlite_master_seed' }).catch(() => ({ value: null }))).value;
            let deviceSalt = (await SecureStoragePlugin.get({ key: 'sqlite_device_salt' }).catch(() => ({ value: null }))).value;

            if (!masterSeed || !deviceSalt) {
                this.logger.log("[LocalDb] Generating new hardware-bound vault secrets...");
                masterSeed = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));
                deviceSalt = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));

                await SecureStoragePlugin.set({ key: 'sqlite_master_seed', value: masterSeed });
                await SecureStoragePlugin.set({ key: 'sqlite_device_salt', value: deviceSalt });
            }

            return await this.derivePassphrase(masterSeed, deviceSalt);
        } catch (err) {
            this.logger.error("[LocalDb] Vault Access Failure - Hardware Lockout?", err);
            // HF-2.1D: Critical Error State
            throw new Error("SECURE_VAULT_UNREACHABLE: Handset security module rejected request.");
        }
    }

    private async derivePassphrase(seed: string, salt: string): Promise<string> {
        const encoder = new TextEncoder();
        const seedBuffer = encoder.encode(seed);
        const saltBuffer = encoder.encode(salt);

        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            seedBuffer,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        const derivedKey = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );

        return btoa(String.fromCharCode(...new Uint8Array(derivedKey)));
    }

    private async createTables() {
        // v2.3 Enterprise Hardened Schema
        const schema = `
            -- 1. Conversations
            CREATE TABLE IF NOT EXISTS local_conversations (
                id TEXT PRIMARY KEY,
                type TEXT, 
                name TEXT,
                photo_url TEXT,
                last_msg_id TEXT,
                last_timestamp INTEGER,
                unread_count INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0,
                is_muted INTEGER DEFAULT 0,
                metadata TEXT 
            );

            -- 2. Messages (Enterprise Hardened - E2EE Strictly Enforced)
            CREATE TABLE IF NOT EXISTS local_messages (
                id TEXT PRIMARY KEY, -- Client UUID (Deduplication Key)
                server_id INTEGER, -- MySQL Primary Key (mapped after sync)
                chat_id TEXT,
                sender_id TEXT,
                type TEXT, 
                payload TEXT, -- Encrypted Base64 envelope (Never store plaintext)
                timestamp INTEGER, -- Client Creation Time
                server_timestamp INTEGER, -- Definitive Sync Order from MySQL
                status TEXT DEFAULT 'pending', -- pending, sent, delivered, read
                forward_count INTEGER DEFAULT 0,
                is_starred INTEGER DEFAULT 0,
                reply_to_id TEXT,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_msg_server ON local_messages(server_id);
            CREATE INDEX IF NOT EXISTS idx_msg_chat_ts ON local_messages(chat_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_msg_order ON local_messages(server_timestamp, timestamp);

            -- 3. Receipts
            CREATE TABLE IF NOT EXISTS local_receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT,
                user_id TEXT,
                status TEXT, 
                timestamp INTEGER,
                UNIQUE(message_id, user_id, status)
            );

            -- 4. Signal Sessions (State Persistence)
            CREATE TABLE IF NOT EXISTS local_signal_sessions (
                identifier TEXT PRIMARY KEY,
                record TEXT 
            );

            -- 5. Signal PreKeys (Pre-fetch buffer)
            CREATE TABLE IF NOT EXISTS local_prekeys (
                id INTEGER PRIMARY KEY,
                key_pair TEXT 
            );

            -- 6. Signal Signed PreKeys
            CREATE TABLE IF NOT EXISTS local_signed_prekeys (
                id INTEGER PRIMARY KEY,
                key_pair TEXT,
                signature TEXT
            );

            -- 7. Pending Queue (v2.3 Robust Scheduling)
            CREATE TABLE IF NOT EXISTS local_pending_queue (
                queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT REFERENCES local_messages(id),
                retry_count INTEGER DEFAULT 0,
                next_retry_at INTEGER DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
                last_error TEXT,
                created_at INTEGER DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
            );

            -- 8. Signal Meta (v2.3 Global Protocol State)
            CREATE TABLE IF NOT EXISTS local_signal_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            -- 9. Local Contacts (Phase 3 Product Unlock)
            CREATE TABLE IF NOT EXISTS local_contacts (
                hash TEXT PRIMARY KEY, -- SHA-256(E164)
                user_id TEXT, -- Resolved if available
                display_name TEXT, -- Local name from device
                phone_last4 TEXT, -- For UI display only
                status TEXT DEFAULT 'invite', -- 'on_chatflect', 'invite'
                photo_url TEXT,
                last_synced_at INTEGER
            );

            -- 10. Sender Keys (Phase 5B: Group Encryption)
            CREATE TABLE IF NOT EXISTS local_sender_keys (
                sender_key_name TEXT PRIMARY KEY, -- "groupId::senderId::deviceId"
                record TEXT 
            );

            -- 11. Sender Signing Key (HF-5B.1)
            CREATE TABLE IF NOT EXISTS local_sender_signing_key (
                id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton
                key_pair TEXT 
            );
        `;
        await this.db.execute(schema);
    }

    async run(sql: string, params: any[] = []) {
        const db = await this.getReady();
        return db.run(sql, params);
    }

    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        const db = await this.getReady();
        const res = await db.query(sql, params);
        return (res.values as T[]) || [];
    }

    async execute(statements: string) {
        const db = await this.getReady();
        return db.execute(statements);
    }
}
