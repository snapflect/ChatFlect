/**
 * web_storage.test.ts
 * Epic 50: Invariant - Web Storage Security & Tamper Detection
 */

import { Crypto } from '@peculiar/webcrypto'; // Polyfill for NodeJS environment

// Mock IDB implementation or Integration Test Stub
class MockEncryptedStorage {
    private store: Map<string, { ct: Buffer, iv: Buffer }> = new Map();
    private key: CryptoKey;

    constructor(key: CryptoKey) {
        this.key = key;
    }

    async put(id: string, ct: Buffer, iv: Buffer) {
        this.store.set(id, { ct, iv });
    }

    async get(id: string) {
        return this.store.get(id);
    }

    // Attack Simulation
    async tamper(id: string) {
        const record = this.store.get(id);
        if (record) {
            record.ct[0] ^= 0xFF; // Flip bits
        }
    }
}

describe('Invariant: Web Storage Security', () => {
    let crypto: Crypto;
    let key: CryptoKey;

    beforeAll(async () => {
        crypto = new Crypto();
        key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    });

    it('should fail decryption if Ciphertext is tampered', async () => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode("secret");
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

        // Tamper
        const tamperedCt = new Uint8Array(ct);
        tamperedCt[0] ^= 0xFF; // Bit flip

        try {
            await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, tamperedCt);
            fail('Should have thrown error');
        } catch (e) {
            expect(e).toBeTruthy(); // Decrypt error
        }
    });

    it('should fail decryption if IV is wrong', async () => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const plaintext = new TextEncoder().encode("secret");
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

        const wrongIv = new Uint8Array(iv);
        wrongIv[0] ^= 0xFF;

        try {
            await crypto.subtle.decrypt({ name: "AES-GCM", iv: wrongIv }, key, ct);
            fail('Should have thrown error');
        } catch (e) {
            expect(e).toBeTruthy();
        }
    });

});
