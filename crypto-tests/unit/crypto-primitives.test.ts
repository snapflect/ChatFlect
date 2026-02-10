/**
 * Unit Tests for Crypto Primitives
 * Story 8.1: Crypto Unit Test Suite
 *
 * Tests Web Crypto API operations used in ChatFlect
 */

describe('Crypto Primitives', () => {
    // ===========================================
    // AES-GCM Encryption/Decryption
    // ===========================================
    describe('AES-GCM Encryption', () => {
        let sessionKey: CryptoKey;
        const IV_LENGTH = 12;

        beforeAll(async () => {
            sessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        });

        it('should encrypt and decrypt text correctly', async () => {
            const plaintext = 'Hello, secure world!';
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            // Encrypt
            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                encoder.encode(plaintext)
            );

            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                ciphertext
            );

            expect(decoder.decode(decrypted)).toBe(plaintext);
        });

        it('should fail decryption with wrong IV', async () => {
            const plaintext = 'Secret message';
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const wrongIv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const encoder = new TextEncoder();

            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                encoder.encode(plaintext)
            );

            await expect(
                crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrongIv }, sessionKey, ciphertext)
            ).rejects.toThrow();
        });

        it('should fail decryption with tampered ciphertext', async () => {
            const plaintext = 'Integrity test';
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const encoder = new TextEncoder();

            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                encoder.encode(plaintext)
            );

            // Tamper with ciphertext
            const tampered = new Uint8Array(ciphertext);
            tampered[0] ^= 0xff;

            await expect(
                crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sessionKey, tampered)
            ).rejects.toThrow();
        });

        it('should handle empty plaintext', async () => {
            const plaintext = '';
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                encoder.encode(plaintext)
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                ciphertext
            );

            expect(decoder.decode(decrypted)).toBe('');
        });

        it('should handle Unicode text', async () => {
            const plaintext = '你好世界 🔐 مرحبا';
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                encoder.encode(plaintext)
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                sessionKey,
                ciphertext
            );

            expect(decoder.decode(decrypted)).toBe(plaintext);
        });
    });

    // ===========================================
    // ECDSA Signing
    // ===========================================
    describe('ECDSA Signing', () => {
        let signingKeyPair: CryptoKeyPair;

        beforeAll(async () => {
            signingKeyPair = await crypto.subtle.generateKey(
                { name: 'ECDSA', namedCurve: 'P-256' },
                true,
                ['sign', 'verify']
            );
        });

        it('should sign and verify payload', async () => {
            const payload = 'Data to sign';
            const encoder = new TextEncoder();

            const signature = await crypto.subtle.sign(
                { name: 'ECDSA', hash: 'SHA-256' },
                signingKeyPair.privateKey,
                encoder.encode(payload)
            );

            const isValid = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                signingKeyPair.publicKey,
                signature,
                encoder.encode(payload)
            );

            expect(isValid).toBe(true);
        });

        it('should fail verification with tampered payload', async () => {
            const payload = 'Original data';
            const encoder = new TextEncoder();

            const signature = await crypto.subtle.sign(
                { name: 'ECDSA', hash: 'SHA-256' },
                signingKeyPair.privateKey,
                encoder.encode(payload)
            );

            const isValid = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                signingKeyPair.publicKey,
                signature,
                encoder.encode('Tampered data')
            );

            expect(isValid).toBe(false);
        });
    });

    // ===========================================
    // Key Wrapping/Unwrapping
    // ===========================================
    describe('Key Wrapping', () => {
        let wrappingKey: CryptoKey;
        let keyToWrap: CryptoKey;

        beforeAll(async () => {
            wrappingKey = await crypto.subtle.generateKey(
                { name: 'AES-KW', length: 256 },
                true,
                ['wrapKey', 'unwrapKey']
            );

            keyToWrap = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        });

        it('should wrap and unwrap key correctly', async () => {
            const wrapped = await crypto.subtle.wrapKey('raw', keyToWrap, wrappingKey, 'AES-KW');

            const unwrapped = await crypto.subtle.unwrapKey(
                'raw',
                wrapped,
                wrappingKey,
                'AES-KW',
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            expect(unwrapped.type).toBe('secret');
        });

        it('should fail unwrap with wrong wrapping key', async () => {
            const wrongKey = await crypto.subtle.generateKey(
                { name: 'AES-KW', length: 256 },
                true,
                ['wrapKey', 'unwrapKey']
            );

            const wrapped = await crypto.subtle.wrapKey('raw', keyToWrap, wrappingKey, 'AES-KW');

            await expect(
                crypto.subtle.unwrapKey(
                    'raw',
                    wrapped,
                    wrongKey,
                    'AES-KW',
                    { name: 'AES-GCM', length: 256 },
                    true,
                    ['encrypt', 'decrypt']
                )
            ).rejects.toThrow();
        });
    });

    // ===========================================
    // SHA-256 Hashing
    // ===========================================
    describe('SHA-256 Hashing', () => {
        it('should produce consistent hash', async () => {
            const data = 'Hash this data';
            const encoder = new TextEncoder();

            const hash1 = await crypto.subtle.digest('SHA-256', encoder.encode(data));
            const hash2 = await crypto.subtle.digest('SHA-256', encoder.encode(data));

            expect(new Uint8Array(hash1)).toEqual(new Uint8Array(hash2));
        });

        it('should produce different hash for different data', async () => {
            const encoder = new TextEncoder();

            const hash1 = await crypto.subtle.digest('SHA-256', encoder.encode('Data 1'));
            const hash2 = await crypto.subtle.digest('SHA-256', encoder.encode('Data 2'));

            expect(new Uint8Array(hash1)).not.toEqual(new Uint8Array(hash2));
        });
    });
});
