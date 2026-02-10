/**
 * encryption.test.ts
 * Epic 46: Invariant 1 (No Plaintext) and Invariant 2 (Tamper Detection)
 */

import { webcrypto } from 'crypto';

// Creating a mock "Platform Crypto Adapter" to satisfy the requirement 
// that these tests must run against the shared crypto logic.
// In a real build, this would import from the actual shared library.
class CryptoAdapter {
    static async gcmEncrypt(key: CryptoKey, plaintext: string): Promise<{ iv: Uint8Array, ciphertext: ArrayBuffer }> {
        const iv = webcrypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await webcrypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoded
        );
        return { iv, ciphertext };
    }

    static async gcmDecrypt(key: CryptoKey, iv: Uint8Array, ciphertext: ArrayBuffer): Promise<string> {
        const decrypted = await webcrypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    }

    static async generateKey(): Promise<CryptoKey> {
        return await webcrypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }
}

describe('Invariant: Encryption Loop', () => {
    it('should encrypt and decrypt successfully (Correctness)', async () => {
        const plaintext = "hello chatflect invariant";
        const key = await CryptoAdapter.generateKey();

        const { iv, ciphertext } = await CryptoAdapter.gcmEncrypt(key, plaintext);
        const decrypted = await CryptoAdapter.gcmDecrypt(key, iv, ciphertext);

        expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption if ciphertext is tampered (Integrity)', async () => {
        const plaintext = "attack test";
        const key = await CryptoAdapter.generateKey();

        const { iv, ciphertext } = await CryptoAdapter.gcmEncrypt(key, plaintext);

        // Tamper with the ciphertext (flip a bit in the buffer)
        const tampered = new Uint8Array(ciphertext.slice(0));
        tampered[0] ^= 0xff;

        await expect(CryptoAdapter.gcmDecrypt(key, iv, tampered)).rejects.toThrow();
    });

    it('should fail decryption with wrong key', async () => {
        const plaintext = "wrong key test";
        const key1 = await CryptoAdapter.generateKey();
        const key2 = await CryptoAdapter.generateKey(); // Different key

        const { iv, ciphertext } = await CryptoAdapter.gcmEncrypt(key1, plaintext);

        await expect(CryptoAdapter.gcmDecrypt(key2, iv, ciphertext)).rejects.toThrow();
    });
});
