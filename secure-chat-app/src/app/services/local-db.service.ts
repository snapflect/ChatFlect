import { Injectable, Injector } from '@angular/core';
import { AppInitService } from './app-init.service';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { NativeBiometric } from 'capacitor-native-biometric';
import { LoggingService } from './logging.service';
import { Platform } from '@ionic/angular';
import { BehaviorSubject, firstValueFrom, Subject } from 'rxjs';
import { filter, take } from 'rxjs/operators';


/**
 * LocalDbService (v2.2 Architecture)
 * Centralized lifecycle management for SQLite (WhatsApp-Style).
 * High-performance, encrypted, and offline-first backbone.
 */

export enum VaultState {
    LOCKED = 'LOCKED',
    UNLOCKING = 'UNLOCKING',
    READY = 'READY'
}

@Injectable({
    providedIn: 'root'
})
export class LocalDbService {
    private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
    private db!: SQLiteDBConnection;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    // HF-Race Fix: Event-driven Vault State
    public vaultState = new BehaviorSubject<VaultState>(VaultState.LOCKED);
    private isUnlocking: boolean = false; // Persistent guard for initialize()
    private tableChangeSubject = new Subject<string>();
    public tableChange$ = this.tableChangeSubject.asObservable();

    public notifyTableChange(tableName: string) {
        this.tableChangeSubject.next(tableName);
    }

    public onTableChange(tableName: string) {
        return this.tableChange$.pipe(filter(t => t === tableName));
    }

    /**
     * HF-8.37: Barrier promise that never orphans waiters.
     * Always reflects the current state of the BehaviorSubject.
     */
    public get readyPromise(): Promise<void> {
        return firstValueFrom(
            this.vaultState.pipe(
                filter(state => state === VaultState.READY),
                take(1)
            )
        ).then(() => { });
    }

    private readonly DB_NAME = 'chatflect_v2_main';
    private readonly MAX_VAULT_ATTEMPTS = 5;

    constructor(
        private logger: LoggingService,
        private platform: Platform,
        private injector: Injector
    ) { }

    private get appInit(): AppInitService {
        return this.injector.get(AppInitService);
    }

    /**
     * HF-Robust: Singleton initialization guard.
     */
    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;
        this.initPromise = this.performInitialization();
        return this.initPromise;
    }

    private async performInitialization(): Promise<void> {
        try {
            this.isUnlocking = true;
            this.vaultState.next(VaultState.UNLOCKING);
            this.logger.log(`[LocalDb] [Boot] Starting initialization...`);

            await this.platform.ready();
            this.logger.log("[LocalDb] [Boot] Platform ready.");

            // Check if vault was nuked - allow boot without biometrics
            const isNuked = localStorage.getItem('vault_nuked') === 'true';
            if (isNuked) {
                this.logger.warn("[LocalDb] [Boot] Vault nuked detected. Skipping biometric gate for recovery.");
            }

            const passphrase = await this.getOrCreatePassphrase();
            this.logger.log("[LocalDb] [Boot] Passphrase derived.");

            if (this.platform.is('hybrid') && !isNuked) {
                this.logger.log("[LocalDb] [Boot] Hybrid detected. Entering biometric gate...");
                // HF-8.31: Stabilizing UI before biometric prompt
                await new Promise(r => setTimeout(r, 800));

                this.logger.log("[LocalDb] [Boot] Checking biometric availability...");
                const isBiometricVerified = await this.verifyBiometrics();
                if (!isBiometricVerified) {
                    this.logger.warn("[LocalDb] [Boot] Biometric gate failed. VAULT_LOCKED.");
                    this.lockVault();
                    throw new Error('BIOMETRIC_FAILED');
                }
                this.logger.log("[LocalDb] [Boot] Biometrics verified.");
            }

            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries) {
                try {
                    this.logger.log(`[LocalDb] [Boot] Connection attempt ${retryCount + 1}...`);

                    // 2. Handle Management (Retrieve or Create)
                    try {
                        this.logger.log(`[LocalDb] [Boot] Checking connection existence for ${this.DB_NAME}...`);
                        const isConn = await this.sqlite.isConnection(this.DB_NAME, false);
                        if (isConn.result) {
                            this.logger.log("[LocalDb] [Boot] Retrieving existing connection...");
                            this.db = await this.sqlite.retrieveConnection(this.DB_NAME, false);
                        } else {
                            this.logger.log("[LocalDb] [Boot] Creating fresh connection...");
                            this.db = await this.sqlite.createConnection(this.DB_NAME, false, 'no-encryption', 1, false);
                        }
                    } catch (handleErr) {
                        this.logger.warn("[LocalDb] [Boot] Handle issue, resetting consistency...", handleErr);
                        await this.sqlite.checkConnectionsConsistency();
                        this.db = await this.sqlite.createConnection(this.DB_NAME, false, 'no-encryption', 1, false);
                    }

                    // 3. Open with Recovery Pattern
                    try {
                        if (!passphrase || passphrase.length < 10) throw new Error("INVALID_PASSPHRASE_MIN_LENGTH");
                        await (this.db as any).open({ encryptionKey: passphrase });
                    } catch (openErr: any) {
                        const msg = openErr.message || "";
                        if (msg.includes("already been set") || msg.includes("already open")) {
                            this.logger.log("[LocalDb] [Boot] Database already open.");
                        } else if (msg.includes("No available connection") && retryCount < maxRetries) {
                            await this.sqlite.closeConnection(this.DB_NAME, false).catch(() => { });
                            retryCount++;
                            continue;
                        } else {
                            throw openErr;
                        }
                    }

                    await this.createTables();
                    this.isInitialized = true;
                    this.vaultState.next(VaultState.READY);
                    this.logger.log(`[LocalDb] [Boot] SUCCESS: Vault operational.`);
                    return;

                } catch (err: any) {
                    this.logger.warn(`[LocalDb] [Boot] Attempt ${retryCount + 1} failed: ${err.message}`, err);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 500));
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err: any) {
            this.logger.error(`[LocalDb] [Boot] Fatal Error: ${err.message}`, err);
            this.lockVault();
            throw err;
        } finally {
            this.isUnlocking = false;
        }
    }

    /**
     * HF-Race Fix: Call this to lock the vault down (e.g., when app backgrounds for too long)
     * Re-creates the readyPromise barrier.
     */
    public lockVault() {
        if (this.vaultState.value !== VaultState.LOCKED) {
            this.logger.warn("[LocalDb] Re-locking Vault. Suspending background services.");
            this.vaultState.next(VaultState.LOCKED);
            this.isInitialized = false;
            this.initPromise = null;
        }
    }


    async getReady(): Promise<SQLiteDBConnection> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (!this.db) {
            throw new Error("VAULT_LOCKED");
        }
        return this.db;
    }

    private async getOrCreatePassphrase(): Promise<string> {
        try {
            // 1. Check for Legacy Passphrase
            const legacy = await SecureStoragePlugin.get({ key: 'sqlite_v2_passphrase' }).catch(() => ({ value: null }));
            if (legacy?.value) {
                this.logger.log("[LocalDb] Using legacy vault passphrase.");
                return legacy.value;
            }

            // 2. Hybrid Derivation Strategy (HF-2.1) with Retry + Integrity
            let masterSeed = await this.secureGetWithRetry('sqlite_master_seed');
            let deviceSalt = await this.secureGetWithRetry('sqlite_device_salt');

            const sentinel = localStorage.getItem('vault_secrets_exist');

            if (sentinel === 'true' && (!masterSeed || !deviceSalt)) {
                this.logger.error("[LocalDb] CRITICAL: SecureStorage read failure. Retrying...");
                const retryResult = await this.retrySecureStorageRead();
                masterSeed = retryResult.masterSeed;
                deviceSalt = retryResult.deviceSalt;

                if (!masterSeed || !deviceSalt) {
                    this.logger.error("[LocalDb] CRITICAL: Throwing error to prevent vault destruction.");
                    throw new Error("SECURE_STORAGE_READ_ERROR: Vault secrets exist but could not be read. Aborting to prevent data loss.");
                }
            }

            if (!masterSeed || !deviceSalt) {

                this.logger.warn("[LocalDb] Hardware secrets missing. Generating new hardware-bound vault secrets...");
                masterSeed = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));
                deviceSalt = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))));

                await SecureStoragePlugin.set({ key: 'sqlite_master_seed', value: masterSeed });
                await SecureStoragePlugin.set({ key: 'sqlite_device_salt', value: deviceSalt });

                // Store sentinel + hash for integrity verification on future reads
                localStorage.setItem('vault_secrets_exist', 'true');
                const seedHash = await this.sha256(masterSeed);
                localStorage.setItem('vault_seed_hash', seedHash);
            } else {
                // Integrity verification: check seed hash matches stored hash
                const storedHash = localStorage.getItem('vault_seed_hash');
                if (storedHash) {
                    const currentHash = await this.sha256(masterSeed);
                    if (currentHash !== storedHash) {
                        this.logger.error("[LocalDb] CRITICAL: Master seed hash mismatch! Keystore may be corrupted or tampered.");
                        throw new Error("VAULT_INTEGRITY_FAILURE: Master seed hash does not match stored hash.");
                    }
                } else {
                    // First boot after upgrade — store hash for future verification
                    const seedHash = await this.sha256(masterSeed);
                    localStorage.setItem('vault_seed_hash', seedHash);
                    localStorage.setItem('vault_secrets_exist', 'true');
                }
            }

            const derived = await this.derivePassphrase(masterSeed, deviceSalt);
            if (!derived || derived.length < 8) {
                throw new Error("PASSPHRASE_DERIVATION_FAILED: Derived key is invalid.");
            }

            return derived;
        } catch (err) {
            this.logger.error("[LocalDb] Vault Access Failure - Hardware Lockout?", err);
            throw new Error("SECURE_VAULT_UNREACHABLE: Handset security module rejected request.");
        }
    }

    /**
     * Retry SecureStoragePlugin.get() up to 3 times with 500ms delay.
     * Handles transient Android Keystore failures.
     */
    private async secureGetWithRetry(key: string, maxRetries = 3): Promise<string | null> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await SecureStoragePlugin.get({ key });
                if (result?.value) return result.value;
            } catch {
                // Keystore read failure
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        return null;
    }

    private async retrySecureStorageRead(): Promise<{ masterSeed: string | null, deviceSalt: string | null }> {
        // Deep explicit retry block as requested by Production Fix
        for (let i = 1; i <= 3; i++) {
            await new Promise(r => setTimeout(r, 1000)); // 1s delay
            this.logger.log(`[LocalDb] Explicit SecureStorage retry attempt ${i}/3...`);
            const m = await SecureStoragePlugin.get({ key: 'sqlite_master_seed' }).catch(() => ({ value: null }));
            const d = await SecureStoragePlugin.get({ key: 'sqlite_device_salt' }).catch(() => ({ value: null }));
            if (m?.value && d?.value) {
                return { masterSeed: m.value, deviceSalt: d.value };
            }
        }
        return { masterSeed: null, deviceSalt: null };
    }

    /**
     * SHA-256 hash for integrity verification of vault secrets.
     */
    private async sha256(input: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
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
            // REMOVED: Proactive VAULT_LOCKED check here prevents recovery.
            // Move to performInitialization logic to allow boot-to-login.

            const availabilityPromise = NativeBiometric.isAvailable();
            const availabilityTimeout = new Promise<any>((_, reject) => {
                setTimeout(() => reject(new Error("BIOMETRIC_AVAILABILITY_TIMEOUT")), 5000);
            });

            const result = await Promise.race([availabilityPromise, availabilityTimeout]);
            if (!result.isAvailable) {
                this.logger.log("[LocalDb] Biometrics not available, skipping gate (Fallback to Device Lock).");
                return true;
            }

            // HF-8.20: Biometric Timeout + Retry to prevent permanent app hang
            let attempts = 0;
            const maxAttempts = 2;
            let verified = false;

            while (attempts < maxAttempts && !verified) {
                attempts++;
                this.logger.log(`[LocalDb] Biometric attempt ${attempts}/${maxAttempts}...`);

                // 5. Trigger System Prompt
                this.logger.log("[LocalDb] [Boot] Launching biometric prompt...");
                this.appInit.pauseWatchdog();
                const biometricPromise = NativeBiometric.verifyIdentity({
                    reason: "Unlock Secure Chat Vault",
                    title: "Authentication Required",
                    subtitle: "Confirm identity to access encrypted messages",
                    description: "This app uses end-to-end encryption",
                    negativeButtonText: "Cancel"
                });

                const timeoutPromise = new Promise<void>((_, reject) => {
                    setTimeout(() => reject(new Error("BIOMETRIC_VERIFY_TIMEOUT")), 15000); // 15s for user to interact
                });

                verified = await Promise.race([biometricPromise, timeoutPromise])
                    .then(() => true)
                    .catch(async (err: any) => {
                        this.logger.warn(`[LocalDb] Biometric attempt ${attempts} failed:`, err);
                        if (attempts < maxAttempts) {
                            await new Promise(r => setTimeout(r, 1000)); // Cool down
                            return false;
                        }
                        return false;
                    });
                this.appInit.resumeWatchdog();
            }

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

    public async triggerNuke() {
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

        // 5. Force Reload to Start Fresh
        window.location.reload();
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
                hash TEXT PRIMARY KEY, -- SHA-256(salt + E164)
                user_id TEXT, -- Resolved if on ChatFlect
                display_name TEXT, -- Local name from device address book
                server_name TEXT, -- first_name from backend (fallback)
                phone_last4 TEXT, -- For UI display only
                phone_e164 TEXT, -- Full E.164 for invite SMS (local only, never sent to server)
                status TEXT DEFAULT 'invite', -- 'on_chatflect', 'invite'
                photo_url TEXT,
                short_note TEXT, -- User's status/about from server
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

            -- 13. Legacy Aliases (HF-8.35: Support older components during bridge phase)
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                data TEXT,
                last_timestamp INTEGER
            );
            CREATE TABLE IF NOT EXISTS meta_cache (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at INTEGER
            );

            -- 14. StorageService Specific Tables
            CREATE TABLE IF NOT EXISTS contacts (
                user_id TEXT PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                phone_number TEXT,
                email TEXT,
                photo_url TEXT,
                public_key TEXT,
                fetched_at INTEGER,
                last_seen INTEGER,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS discovery_cache (
                query TEXT PRIMARY KEY,
                results TEXT,
                expires_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS media_cache (
                url TEXT PRIMARY KEY,
                blob_path TEXT,
                mime TEXT,
                file_size INTEGER DEFAULT 0,
                updated_at INTEGER,
                last_verified_at INTEGER,
                verification_status TEXT DEFAULT 'verified',
                last_used INTEGER
            );

            CREATE TABLE IF NOT EXISTS media_retries (
                url TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                next_retry INTEGER,
                last_logged INTEGER
            );

            CREATE TABLE IF NOT EXISTS outbox (
                id TEXT PRIMARY KEY,
                chat_id TEXT,
                action TEXT,
                payload TEXT,
                timestamp INTEGER,
                retry_count INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_chat ON outbox(chat_id);

            -- 15. Status Cache (v2.3)
            CREATE TABLE IF NOT EXISTS status_cache (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                feed_data TEXT,
                cache_time INTEGER,
                schema_version INTEGER DEFAULT 1
            );
        `;
        await this.db.execute(schema);
    }

    async run(sql: string, params: any[] = []) {
        await this.readyPromise;
        const db = await this.getReady();
        const res = await db.run(sql, params);

        if (sql.includes('local_messages')) {
            this.notifyTableChange('local_messages');
        }

        return res;
    }

    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        await this.readyPromise;
        const db = await this.getReady();
        const res = await db.query(sql, params);
        return (res.values as T[]) || [];
    }

    async execute(statements: string) {
        const db = await this.getReady();
        return db.execute(statements);
    }

    public async forceReconnect() {
        this.logger.warn('[LocalDb] Forcing reconnection and unlocking vault state...');
        this.vaultState.next(VaultState.LOCKED); // Temporarily lock to block rapid consumers
        this.isInitialized = false;
        this.initPromise = null;
        try {
            await this.sqlite.closeConnection(this.DB_NAME, false);
        } catch (e) { } // ignore if already closed
        return this.initialize();
    }

    async runHealthCheck() {
        if (!(await this.isReady())) return; // Guard
        try {
            console.log('[LocalDbService][v14] Running Integrity Check...');
            const values = await this.safeQuery('PRAGMA integrity_check');
            const result = values.length > 0 ? Object.values(values[0])[0] : 'unknown';

            if (result !== 'ok') {
                console.error('[LocalDbService][v14] CORRUPTION DETECTED:', result);
                // Attempt VACUUM to rebuild
                await this.safeExecute('VACUUM');
                console.log('[LocalDbService][v14] VACUUM completed. Re-checking...');

                const res2 = await this.query('PRAGMA integrity_check');
                const result2 = res2.length > 0 ? Object.values(res2[0])[0] : 'unknown';

                if (result2 !== 'ok') {
                    console.error('[LocalDbService][v14] FATAL: VACUUM failed. Database may be unsafe.');
                }
            } else {
                console.log('[LocalDbService][v14] Integrity Check Passed (ok)');

                // Optional: Log Size
                const sizeRes = await this.query('PRAGMA page_count');
                const pageSizeRes = await this.query('PRAGMA page_size');
                if (sizeRes.length > 0 && pageSizeRes.length > 0) {
                    const size = (Object.values(sizeRes[0])[0] as number) * (Object.values(pageSizeRes[0])[0] as number);
                    console.log(`[LocalDbService][v14] DB Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
                }
            }
        } catch (e) {
            console.error('[LocalDbService] Integrity Check Exception', e);
        }
    }

    // Helper for health check
    private async safeQuery<T = any>(statement: string, values: any[] = []): Promise<T[]> {
        return this.query<T>(statement, values);
    }
    private async safeExecute(statements: string): Promise<any> {
        return this.execute(statements);
    }
    private async isReady(): Promise<boolean> {
        return this.vaultState.value === VaultState.READY;
    }
}
