import { Injectable } from '@angular/core';
import { StorageKDFService } from './storage-kdf.service'; // Adjust import if needed, assuming relative path

/**
 * Encrypted IndexedDB Wrapper
 * Enforces AES-GCM encryption for all records.
 * Schema:
 * {
 *   id: string,
 *   ct: ArrayBuffer, // Ciphertext
 *   iv: ArrayBuffer, // Unique IV
 *   meta: any // Plaintext metadata (minimal)
 * }
 */
@Injectable({
    providedIn: 'root'
})
export class EncryptedStorageService {
    private db: IDBDatabase | null = null;
    private keys: Map<string, CryptoKey> = new Map();

    // Hardening: Rate Limiting
    private opCount = 0;
    private lastReset = Date.now();
    private readonly MAX_OPS_PER_SEC = 100;

    constructor(private kdf: StorageKDFService) { }

    private checkRateLimit() {
        const now = Date.now();
        if (now - this.lastReset > 1000) {
            this.opCount = 0;
            this.lastReset = now;
        }
        if (this.opCount++ > this.MAX_OPS_PER_SEC) {
            throw new Error('Storage Rate Limit Exceeded');
        }
    }

    async init(dbName: string, version: number): Promise<void> {
        // 1. Open DB
        this.db = await this.openDB(dbName, version);

        // 2. Derive Keys for all contexts
        this.keys.set('messages', await this.kdf.deriveStorageKey('messages'));
        this.keys.set('sessions', await this.kdf.deriveStorageKey('sessions'));
        this.keys.set('registry', await this.kdf.deriveStorageKey('registry'));
    }

    private openDB(name: string, version: number): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(name, version);
            req.onupgradeneeded = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('registry')) db.createObjectStore('registry', { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async put(storeName: 'messages' | 'sessions' | 'registry', id: string, data: any): Promise<void> {
        this.checkRateLimit();
        const key = this.keys.get(storeName);
        if (!key) throw new Error(`No key for context ${storeName}`);

        // Encrypt
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode(JSON.stringify(data));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            plaintext
        );

        // Store
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.put({ id, ct: ciphertext, iv: iv });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async get(storeName: 'messages' | 'sessions' | 'registry', id: string): Promise<any | null> {
        this.checkRateLimit();
        const key = this.keys.get(storeName);
        if (!key) throw new Error(`No key for context ${storeName}`);

        // Retrieve
        const record = await new Promise<any>((resolve, reject) => {
            const tx = this.db!.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (!record) return null;

        // Decrypt
        try {
            const plaintextBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: record.iv },
                key,
                record.ct
            );
            return JSON.parse(new TextDecoder().decode(plaintextBuffer));
        } catch (e) {
            console.error('Decryption failed for record', id);
            return null; // Fail-safe (Tamper detected)
        }
    }
}
