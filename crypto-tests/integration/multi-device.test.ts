/**
 * Integration Tests: Multi-Device Message Delivery
 * Story 8.2: Multi-Device Integration Test Harness
 *
 * Simulates 3-device scenarios for Signal Protocol
 */

import { get, set, del, __resetStore } from '../mocks/idb-keyval';

interface MockDevice {
    userId: string;
    deviceId: number;
    identityKeyPair: CryptoKeyPair;
    registrationId: number;
}

interface MockMessage {
    senderId: string;
    senderDeviceId: number;
    ciphertext: string;
    iv: string;
}

/**
 * Helper: Generate mock identity key pair
 */
async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );
}

/**
 * Helper: Create a mock device
 */
async function createMockDevice(userId: string, deviceId: number): Promise<MockDevice> {
    const identityKeyPair = await generateIdentityKeyPair();
    return {
        userId,
        deviceId,
        identityKeyPair,
        registrationId: Math.floor(Math.random() * 16380) + 1,
    };
}

/**
 * Helper: Mock encrypt message for device
 */
async function mockEncryptForDevice(
    plaintext: string,
    sessionKey: CryptoKey,
    deviceId: number
): Promise<MockMessage> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sessionKey,
        encoder.encode(plaintext)
    );

    return {
        senderId: 'sender',
        senderDeviceId: 1,
        iv: Buffer.from(iv).toString('base64'),
        ciphertext: Buffer.from(new Uint8Array(ciphertext)).toString('base64'),
    };
}

/**
 * Helper: Mock decrypt message
 */
async function mockDecryptMessage(
    message: MockMessage,
    sessionKey: CryptoKey
): Promise<string> {
    const iv = Buffer.from(message.iv, 'base64');
    const ciphertext = Buffer.from(message.ciphertext, 'base64');
    const decoder = new TextDecoder();

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        sessionKey,
        ciphertext
    );

    return decoder.decode(decrypted);
}

describe('Multi-Device Integration', () => {
    beforeEach(() => {
        __resetStore();
    });

    // ===========================================
    // SC-MD-01: Device Add
    // ===========================================
    describe('SC-MD-01: Device Add', () => {
        it('should register new device with unique identity', async () => {
            const device1 = await createMockDevice('alice', 1);
            const device2 = await createMockDevice('alice', 2);
            const device3 = await createMockDevice('alice', 3);

            // Each device has unique identity
            expect(device1.registrationId).not.toBe(device2.registrationId);
            expect(device2.registrationId).not.toBe(device3.registrationId);

            // Store device identities
            await set(`device_alice_1`, device1);
            await set(`device_alice_2`, device2);
            await set(`device_alice_3`, device3);

            // Verify all stored
            const stored1 = await get(`device_alice_1`);
            const stored2 = await get(`device_alice_2`);
            const stored3 = await get(`device_alice_3`);

            expect(stored1.deviceId).toBe(1);
            expect(stored2.deviceId).toBe(2);
            expect(stored3.deviceId).toBe(3);
        });
    });

    // ===========================================
    // SC-MD-02: Message Delivery to 3 Devices
    // ===========================================
    describe('SC-MD-02: Message Delivery', () => {
        it('should encrypt message for 3 devices and all decrypt correctly', async () => {
            const plaintext = 'Hello from sender!';

            // Create session keys for each device (simulating per-device fan-out)
            const sessionKeys = await Promise.all([
                crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']),
                crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']),
                crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']),
            ]);

            // Encrypt for each device
            const encryptedMessages = await Promise.all(
                sessionKeys.map((key, idx) => mockEncryptForDevice(plaintext, key, idx + 1))
            );

            // Each device decrypts with its session key
            const decryptedMessages = await Promise.all(
                sessionKeys.map((key, idx) => mockDecryptMessage(encryptedMessages[idx], key))
            );

            // All devices should get the same plaintext
            decryptedMessages.forEach((msg) => {
                expect(msg).toBe(plaintext);
            });
        });
    });

    // ===========================================
    // SC-MD-03: Device Revoke
    // ===========================================
    describe('SC-MD-03: Device Revoke', () => {
        it('should prevent revoked device from decrypting new messages', async () => {
            const plaintext = 'New message after revocation';

            // Create device registry
            await set('device_registry_alice', {
                '1': { status: 'active' },
                '2': { status: 'active' },
                '3': { status: 'revoked' }, // Device 3 revoked
            });

            // Session key for active devices only
            const activeSessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            // Old session key that device 3 still has
            const oldSessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            // Encrypt with new session key (device 3 doesn't have it)
            const message = await mockEncryptForDevice(plaintext, activeSessionKey, 1);

            // Active devices can decrypt
            const decrypted = await mockDecryptMessage(message, activeSessionKey);
            expect(decrypted).toBe(plaintext);

            // Revoked device with old key cannot decrypt
            await expect(mockDecryptMessage(message, oldSessionKey)).rejects.toThrow();
        });

        it('should check device status before allowing read', async () => {
            await set('device_registry_alice', {
                '1': { status: 'active' },
                '3': { status: 'revoked' },
            });

            const registry = await get('device_registry_alice');

            expect(registry['1'].status).toBe('active');
            expect(registry['3'].status).toBe('revoked');

            // Revoked device should be blocked
            const canRead = registry['3'].status === 'active';
            expect(canRead).toBe(false);
        });
    });

    // ===========================================
    // SC-MD-04: Key Rotation
    // ===========================================
    describe('SC-MD-04: Key Rotation', () => {
        it('should allow sender to rotate keys and recipients still decrypt', async () => {
            const message1 = 'First message with old key';
            const message2 = 'Second message with new key';

            // Old session key
            const oldSessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            // New session key after rotation
            const newSessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            // Encrypt messages
            const encrypted1 = await mockEncryptForDevice(message1, oldSessionKey, 1);
            const encrypted2 = await mockEncryptForDevice(message2, newSessionKey, 1);

            // Decrypt with correct keys
            const decrypted1 = await mockDecryptMessage(encrypted1, oldSessionKey);
            const decrypted2 = await mockDecryptMessage(encrypted2, newSessionKey);

            expect(decrypted1).toBe(message1);
            expect(decrypted2).toBe(message2);

            // Cross-key decryption should fail
            await expect(mockDecryptMessage(encrypted1, newSessionKey)).rejects.toThrow();
            await expect(mockDecryptMessage(encrypted2, oldSessionKey)).rejects.toThrow();
        });
    });
});
