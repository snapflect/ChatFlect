import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { NativeBiometric } from 'capacitor-native-biometric';
import { LoggingService } from './logging.service';
import { Platform } from '@ionic/angular';

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
    private readonly MAX_VAULT_ATTEMPTS = 5;

    constructor(
        private logger: LoggingService,
        private platform: Platform
    ) { }

    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                this.logger.log(`[LocalDb] [Checkpoint 1] Starting initialization...`);

                const passphrase = await this.getOrCreatePassphrase();
                this.logger.log("[LocalDb] [Checkpoint 2] Passphrase derived.");

                if (this.platform.is('hybrid')) {
                    this.logger.log("[LocalDb] [Checkpoint 3] Hybrid mode. Waiting for UI thread...");
                    await new Promise(r => setTimeout(r, 1000));

                    const isBiometricVerified = await this.verifyBiometrics();
                    if (!isBiometricVerified) {
                        this.logger.error("[LocalDb] [Checkpoint 3.F] Biometric verification failed or cancelled.");
                        throw new Error("BIOMETRIC_FAILED");
                    }
                    this.logger.log("[LocalDb] [Checkpoint 4] Biometrics verified. Cooling down bridge bridge...");
                    await new Promise(r => setTimeout(r, 1500));
                }

                let retryCount = 0;
                const maxRetries = 2;

                while (retryCount <= maxRetries) {
                    try {
                        this.logger.log(`[LocalDb] [Checkpoint 5] Connection attempt ${retryCount + 1}/${maxRetries + 1}...`);

                        // 2. Handle Management (Retrieve or Create)
                        try {
                            const isConn = await this.sqlite.isConnection(this.DB_NAME, false);
                            if (isConn.result) {
                                this.logger.log("[LocalDb] [Checkpoint 5.1] Retrieving existing connection...");
                                this.db = await this.sqlite.retrieveConnection(this.DB_NAME, false);
                            } else {
                                this.logger.log("[LocalDb] [Checkpoint 5.2] Creating fresh connection...");
                                this.db = await this.sqlite.createConnection(this.DB_NAME, true, 'encryption', 1, false);
                            }
                        } catch (handleErr) {
                            this.logger.warn("[LocalDb] [Checkpoint 5.H] Handle setup issue, forcing consistency reset...", handleErr);
                            await this.sqlite.checkConnectionsConsistency();
                            this.db = await this.sqlite.createConnection(this.DB_NAME, true, 'encryption', 1, false);
                        }

                        // 3. Open with Recovery Pattern
                        try {
                            this.logger.log("[LocalDb] [Checkpoint 6] Opening database...");
                            await (this.db as any).open({ encryptionKey: passphrase });
                        } catch (openErr: any) {
                            const msg = openErr.message || "";
                            if (msg.includes("already been set") || msg.includes("already open")) {
                                this.logger.log("[LocalDb] [Checkpoint 6.S] Database already open, continuing.");
                            } else if (msg.includes("No available connection") && retryCount < maxRetries) {
                                this.logger.warn("[LocalDb] [Checkpoint 6.R] No connection available, nuking handle and retrying.");
                                await this.sqlite.closeConnection(this.DB_NAME, false).catch(() => { });
                                retryCount++;
                                continue;
                            } else {
                                throw openErr;
                            }
                        }

                        this.logger.log("[LocalDb] [Checkpoint 7] Ensuring schema...");
                        await this.createTables();
                        this.isInitialized = true;
                        this.logger.log(`[LocalDb] [Checkpoint 8] SUCCESS: Initialized.`);
                        return; // Done

                    } catch (err: any) {
                        this.logger.warn(`[LocalDb] [Checkpoint 5.E] Attempt failed: ${err.message}`, err);
                        if (retryCount < maxRetries) {
                            retryCount++;
                            await new Promise(r => setTimeout(r, 500));
                        } else {
                            throw err;
                        }
                    }
                }
            } catch (err: any) {
                // Precise error serialization for debugging
                const errorDetail = err instanceof Error ? {
                    message: err.message,
                    name: err.name,
                    stack: err.stack,
                    ...(err as any)
                } : err;

                if (err.message === 'VAULT_LOCKED') {
                    this.logger.error("[LocalDb] Vault is locked.");
                } else {
                    this.logger.error(`[LocalDb] Initialization Fatal Error: ${JSON.stringify(errorDetail)}`, err);
                }
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

    private async verifyBiometrics(): Promise<boolean> {
        try {
            // Check if vault is already nuked
            if (localStorage.getItem('vault_nuked') === 'true') {
                throw new Error('VAULT_LOCKED');
            }

            const result = await NativeBiometric.isAvailable();
            if (!result.isAvailable) {
                this.logger.log("[LocalDb] Biometrics not available, skipping gate (Fallback to Device Lock).");
                return true;
            }

            // HF-8.20: Biometric Timeout to prevent permanent app hang
            const biometricPromise = NativeBiometric.verifyIdentity({
                reason: "Unlock your secure messaging vault",
                title: "Vault Access",
                subtitle: "ChatFlect Security",
                description: "Verify your identity to access encrypted messages.",
                useFallback: true // Allow PIN if biometrics fail
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("BIOMETRIC_TIMEOUT")), 20000);
            });

            const verified = await Promise.race([biometricPromise, timeoutPromise])
                .then(() => true)
                .catch((err: any) => {
                    this.logger.warn("[LocalDb] Biometric verification failed or timed out:", err);
                    return false;
                });

            if (verified) {
                localStorage.setItem('vault_fail_count', '0');
                return true;
            } else {
                await this.handleFailedAttempt();
                return false;
            }
        } catch (e: any) {
            if (e.message === 'VAULT_LOCKED') throw e;
            this.logger.warn("[LocalDb] Biometric Error", e);
            return false;
        }
    }

    private async handleFailedAttempt() {
        const currentCount = parseInt(localStorage.getItem('vault_fail_count') || '0') + 1;
        localStorage.setItem('vault_fail_count', currentCount.toString());

        this.logger.warn(`[Security][HF-6.2] Failed vault access attempt ${currentCount}/${this.MAX_VAULT_ATTEMPTS}`);

        if (currentCount >= this.MAX_VAULT_ATTEMPTS) {
            await this.triggerNuke();
        }
    }

    private async triggerNuke() {
        this.logger.error("[Critical][Security] NUKE TRIGGERED: Wiping all local data due to multiple failed access attempts.");

        // 1. Mark as permanently locked to prevent further attempts until fresh login
        localStorage.setItem('vault_nuked', 'true');

        // 2. Wipe Hardware Seeds
        await SecureStoragePlugin.remove({ key: 'sqlite_master_seed' }).catch(() => { });
        await SecureStoragePlugin.remove({ key: 'sqlite_device_salt' }).catch(() => { });
        await SecureStoragePlugin.remove({ key: 'sqlite_v2_passphrase' }).catch(() => { });

        // 3. Clear all LocalStorage (except the nuke flag for current session)
        const keysToKeep = ['vault_nuked'];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        }

        // 4. Delete Database Physically
        try {
            // HF-6.2 / HF-8.5: Accurate Capacitor SQLite v6 signature for physical file removal
            await CapacitorSQLite.deleteDatabase({ database: this.DB_NAME, readonly: false });
        } catch (e) {
            this.logger.warn("[LocalDb] Failed to delete database file during nuke", e);
        }

        // 5. Force Reload to Login
        window.location.href = '/login';
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

            -- 12. Anti-Replay Cache (HF-5D.6)
            -- Prevents duplicate content rendering even after Signal session resets
            CREATE TABLE IF NOT EXISTS local_seen_message_ids (
                sender_device_uuid TEXT NOT NULL,
                message_uuid TEXT NOT NULL,
                received_at INTEGER NOT NULL,
                PRIMARY KEY(sender_device_uuid, message_uuid)
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
