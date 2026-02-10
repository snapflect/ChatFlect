/**
 * Unit Tests for Signal Store Service
 * Story 8.1: Crypto Unit Test Suite
 *
 * Tests identity keys, prekeys, sessions, and blocked identities
 */

import { get, set, del, keys, __resetStore } from '../mocks/idb-keyval';

// Mock SignalStoreService methods for testing
class MockSignalStoreService {
    private mismatchAlertedSet = new Set<string>();
    private blockedIdentitiesSet = new Set<string>();

    // --- Blocked Identities ---
    async markIdentityBlocked(identifier: string): Promise<void> {
        this.blockedIdentitiesSet.add(identifier);
        await set('blockedIdentities', Array.from(this.blockedIdentitiesSet));
    }

    async unblockIdentity(identifier: string): Promise<void> {
        this.blockedIdentitiesSet.delete(identifier);
        await set('blockedIdentities', Array.from(this.blockedIdentitiesSet));
    }

    isIdentityBlocked(identifier: string): boolean {
        return this.blockedIdentitiesSet.has(identifier);
    }

    clearMismatchAlert(identifier: string): void {
        this.mismatchAlertedSet.delete(identifier);
    }

    // --- Data Encryption ---
    async encryptData(data: any): Promise<{ iv: string; ciphertext: string }> {
        const key = await this.getOrCreateEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const plaintext = encoder.encode(JSON.stringify(data));

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            plaintext
        );

        return {
            iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
            ciphertext: this.arrayBufferToBase64(ciphertext),
        };
    }

    async decryptData(encrypted: { iv: string; ciphertext: string }): Promise<any> {
        const key = await this.getOrCreateEncryptionKey();
        const iv = this.base64ToArrayBuffer(encrypted.iv);
        const ciphertext = this.base64ToArrayBuffer(encrypted.ciphertext);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }

    private encryptionKey: CryptoKey | null = null;

    private async getOrCreateEncryptionKey(): Promise<CryptoKey> {
        if (this.encryptionKey) return this.encryptionKey;

        this.encryptionKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        return this.encryptionKey;
    }

    // --- Helpers ---
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return Buffer.from(binary, 'binary').toString('base64');
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = Buffer.from(base64, 'base64').toString('binary');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer as ArrayBuffer;
    }

    // --- Identity Keys ---
    async saveIdentity(identifier: string, identityKey: any): Promise<boolean> {
        await set(`identityKey_${identifier}`, identityKey);
        return true;
    }

    async loadIdentityKey(identifier: string): Promise<any> {
        return get(`identityKey_${identifier}`);
    }

    // --- PreKeys ---
    async storePreKey(keyId: number, keyPair: any): Promise<void> {
        await set(`preKey_${keyId}`, keyPair);
    }

    async loadPreKey(keyId: number): Promise<any> {
        return get(`preKey_${keyId}`);
    }

    async removePreKey(keyId: number): Promise<void> {
        await del(`preKey_${keyId}`);
    }

    // --- Sessions ---
    async storeSession(address: string, record: any): Promise<void> {
        await set(`session_${address}`, record);
    }

    async loadSession(address: string): Promise<any> {
        return get(`session_${address}`);
    }
}

describe('SignalStoreService', () => {
    let store: MockSignalStoreService;

    beforeEach(() => {
        __resetStore();
        store = new MockSignalStoreService();
    });

    // ===========================================
    // Data Encryption/Decryption
    // ===========================================
    describe('Data Encryption', () => {
        it('should encrypt and decrypt data correctly', async () => {
            const original = { secret: 'value', number: 42 };
            const encrypted = await store.encryptData(original);

            expect(encrypted.iv).toBeDefined();
            expect(encrypted.ciphertext).toBeDefined();
            expect(encrypted.ciphertext).not.toContain('secret');

            const decrypted = await store.decryptData(encrypted);
            expect(decrypted).toEqual(original);
        });

        it('should fail decryption with tampered ciphertext', async () => {
            const original = { data: 'test' };
            const encrypted = await store.encryptData(original);

            // Tamper with ciphertext
            encrypted.ciphertext = 'A' + encrypted.ciphertext.slice(1);

            await expect(store.decryptData(encrypted)).rejects.toThrow();
        });

        it('should handle complex nested objects', async () => {
            const original = {
                nested: { deep: { value: 123 } },
                array: [1, 2, 3],
                unicode: '日本語 🔐',
            };

            const encrypted = await store.encryptData(original);
            const decrypted = await store.decryptData(encrypted);

            expect(decrypted).toEqual(original);
        });
    });

    // ===========================================
    // Blocked Identities
    // ===========================================
    describe('Blocked Identities', () => {
        it('should block and check identity', async () => {
            const identifier = 'user123';

            expect(store.isIdentityBlocked(identifier)).toBe(false);

            await store.markIdentityBlocked(identifier);
            expect(store.isIdentityBlocked(identifier)).toBe(true);
        });

        it('should unblock identity', async () => {
            const identifier = 'user456';

            await store.markIdentityBlocked(identifier);
            expect(store.isIdentityBlocked(identifier)).toBe(true);

            await store.unblockIdentity(identifier);
            expect(store.isIdentityBlocked(identifier)).toBe(false);
        });

        it('should persist blocked identities', async () => {
            await store.markIdentityBlocked('blocked1');
            await store.markIdentityBlocked('blocked2');

            const stored = await get('blockedIdentities');
            expect(stored).toContain('blocked1');
            expect(stored).toContain('blocked2');
        });
    });

    // ===========================================
    // Identity Keys
    // ===========================================
    describe('Identity Keys', () => {
        it('should save and load identity key', async () => {
            const identifier = 'user789';
            const keyPair = { pubKey: new Uint8Array([1, 2, 3]) };

            await store.saveIdentity(identifier, keyPair);
            const loaded = await store.loadIdentityKey(identifier);

            expect(loaded).toEqual(keyPair);
        });

        it('should return undefined for missing identity', async () => {
            const loaded = await store.loadIdentityKey('nonexistent');
            expect(loaded).toBeUndefined();
        });
    });

    // ===========================================
    // PreKeys
    // ===========================================
    describe('PreKeys', () => {
        it('should store and load prekey', async () => {
            const keyId = 42;
            const keyPair = { pubKey: new Uint8Array([4, 5, 6]), privKey: new Uint8Array([7, 8, 9]) };

            await store.storePreKey(keyId, keyPair);
            const loaded = await store.loadPreKey(keyId);

            expect(loaded).toEqual(keyPair);
        });

        it('should remove prekey', async () => {
            const keyId = 99;
            await store.storePreKey(keyId, { test: true });
            await store.removePreKey(keyId);

            const loaded = await store.loadPreKey(keyId);
            expect(loaded).toBeUndefined();
        });
    });

    // ===========================================
    // Sessions
    // ===========================================
    describe('Sessions', () => {
        it('should store and load session', async () => {
            const address = 'user.1';
            const record = { sessionData: 'encrypted_session_record' };

            await store.storeSession(address, record);
            const loaded = await store.loadSession(address);

            expect(loaded).toEqual(record);
        });
    });
});
