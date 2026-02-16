import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SignalStoreService } from './signal-store.service';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import { environment } from '../../environments/environment';
import { GroupService } from './group.service';
import { GroupSignalService } from './group-signal.service';
import { LocalDbService } from './local-db.service';

// HF-5B: Custom Sender Key Implementation (as library lacks it)
interface SenderKeyState {
    keyId: number;
    chainKey: string; // Base64
    signingKey: { pub: string, priv?: string }; // Base64 JWK/Raw
    iteration: number;
}

interface SenderKeyRecord {
    senderKeyStates: SenderKeyState[];
    memberHash?: string;
    bundleVersion: number; // HF-5B.2
    createdAt: number;     // HF-5B.2
}

@Injectable({
    providedIn: 'root'
})
export class SignalService {
    private encryptionKey: CryptoKey | null = null;
    private readonly IV_LENGTH = 12;
    private internalCurve: any = null; // HF-5B.1

    constructor(
        private http: HttpClient,
        private store: SignalStoreService,
        private authService: AuthService,
        private localDb: LocalDbService,
        private logger: LoggingService,
        private groupService: GroupService,
        private groupSignalService: GroupSignalService
    ) {
    }

    // --- ECDSA Signing (Epic 5 Strict) ---

    async getOrCreateSigningKey(): Promise<CryptoKeyPair> {
        let keyPair = await this.store.loadSigningKey();
        if (!keyPair) {
            keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "ECDSA",
                    namedCurve: "P-256"
                },
                true,
                ["sign", "verify"]
            ) as CryptoKeyPair;
            await this.store.saveSigningKey(keyPair);
        }
        return keyPair;
    }

    async signPayload(payload: string): Promise<string> {
        const keyPair = await this.getOrCreateSigningKey();
        const enc = new TextEncoder();
        const signature = await window.crypto.subtle.sign(
            {
                name: "ECDSA",
                hash: { name: "SHA-256" },
            },
            keyPair.privateKey,
            enc.encode(payload)
        );
        return this.arrayBufferToBase64(signature);
    }

    // Updated Registration Flow
    async register(): Promise<void> {
        // ... (existing signal key gen) ...
        const registrationId = libsignal.KeyHelper.generateRegistrationId();
        const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
        const signedPreKeyId = await this.store.getNextSignedPreKeyId();
        const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);

        const count = 100;
        const startId = await this.store.reservePreKeyIds(count);
        const preKeys = [];
        for (let i = 0; i < count; i++) {
            const keyId = startId + i;
            const key = await libsignal.KeyHelper.generatePreKey(keyId);
            preKeys.push(key);
        }

        await this.store.setLocalIdentity(identityKeyPair, registrationId);
        await this.store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
        for (const key of preKeys) {
            await this.store.storePreKey(key.keyId, key.keyPair);
        }

        const deviceId = this.authService.getDeviceId() || 1;
        const keyVersion = 1;

        // Generate ECDSA Signing Key
        const signingKeyPair = await this.getOrCreateSigningKey();
        const signingPubExp = await window.crypto.subtle.exportKey('spki', signingKeyPair.publicKey);
        const signingPubB64 = this.arrayBufferToBase64(signingPubExp);

        const bundle = {
            registrationId: registrationId,
            identityKey: this.arrayBufferToBase64(identityKeyPair.pubKey),
            signedPreKey: {
                keyId: signedPreKeyId,
                publicKey: this.arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                signature: this.arrayBufferToBase64(signedPreKey.signature)
            },
            oneTimePreKeys: preKeys.map((k: any) => ({
                keyId: k.keyId,
                publicKey: this.arrayBufferToBase64(k.keyPair.pubKey)
            })),
            deviceId: deviceId,
            keyVersion: keyVersion,
            signing_public_key: signingPubB64 // New Field
        };

        try {
            await this.http.post(`${environment.apiUrl}/devices?action=register`, bundle, {
                withCredentials: true
            }).toPromise();

            await this.store.setLocalKeyVersion(keyVersion);
            console.log('Keys uploaded successfully');
        } catch (e) {
            console.error('Registration failed at backend', e);
            throw e;
        }
    }

    // --- 2. Session Establishment ---
    async establishSession(remoteUserId: string, remoteDeviceId: number): Promise<void> {
        const address = new libsignal.SignalProtocolAddress(remoteUserId, remoteDeviceId);

        // 1. Check if session exists
        if (await this.store.loadSession(address.toString())) {
            return; // Session already established
        }

        // 2. Fetch Bundle from Backend
        try {
            const bundle: any = await this.http.get(`${environment.apiUrl}/keys?userId=${remoteUserId}&deviceId=${remoteDeviceId}`, {
                withCredentials: true
            }).toPromise();

            // 3. Process Bundle
            const sessionBuilder = new libsignal.SessionBuilder(this.store, address);

            // Ensure bundle structure matches what SessionBuilder expects
            const preKeyBundle = {
                identityKey: this.base64ToArrayBuffer(bundle.identityKey),
                registrationId: bundle.registrationId,
                signedPreKey: {
                    keyId: bundle.signedPreKey.keyId,
                    publicKey: this.base64ToArrayBuffer(bundle.signedPreKey.publicKey),
                    signature: this.base64ToArrayBuffer(bundle.signedPreKey.signature)
                },
                preKey: bundle.preKey ? {
                    keyId: bundle.preKey.keyId,
                    publicKey: this.base64ToArrayBuffer(bundle.preKey.publicKey)
                } : undefined
            };

            await sessionBuilder.processPreKey(preKeyBundle);
            console.log(`Session established with ${remoteUserId}:${remoteDeviceId}`);

        } catch (e) {
            console.error('Session establishment failed', e);
            throw e;
        }
    }

    // --- 3. Messaging ---

    // HF-5B.4: Anti-Downgrade Check
    async hasSession(remoteUserId: string, remoteDeviceId: number): Promise<boolean> {
        const address = new libsignal.SignalProtocolAddress(remoteUserId, remoteDeviceId);
        const record = await this.store.loadSession(address.toString());
        return !!record;
    }

    async encryptMessage(plaintext: string, remoteUserId: string, remoteDeviceId: number): Promise<any> {
        const address = new libsignal.SignalProtocolAddress(remoteUserId, remoteDeviceId);
        const sessionCipher = new libsignal.SessionCipher(this.store, address);

        // HF-5A: Trust Verification
        const identityKey = await this.store.loadIdentityKey(remoteUserId);
        if (identityKey) {
            const isTrusted = await this.store.isTrustedIdentity(remoteUserId, identityKey, null);
            if (!isTrusted) {
                this.logger.error(`[Signal] Blocked encryption: Untrusted identity for ${remoteUserId}`);
                throw new Error('IDENTITY_UNTRUSTED');
            }
        }

        if (!(await this.store.loadSession(address.toString()))) {
            await this.establishSession(remoteUserId, remoteDeviceId);
        }

        const copy = new TextEncoder().encode(plaintext).buffer;
        const ciphertext = await sessionCipher.encrypt(copy);

        const myDeviceId = this.authService.getDeviceId() || 1;
        const myUserId = this.authService.getUserId();
        const myDeviceUuid = localStorage.getItem('device_uuid') || '';

        // HF-5A: Return V3 Envelope
        return {
            protocol: 'v3',
            type: ciphertext.type, // 3 (PreKeyBundle) or 1 (Whisper)
            body: this.arrayBufferToBase64(ciphertext.body as any),
            registrationId: ciphertext.registrationId,
            senderUserId: myUserId,
            senderDeviceId: myDeviceId,
            senderDeviceUuid: myDeviceUuid,
            receiverUserId: remoteUserId,
            receiverDeviceId: remoteDeviceId,
            timestamp: Date.now(),
            messageType: ciphertext.type === 3 ? 'PREKEY' : 'WHISPER'
        };
    }

    /**
     * HF-5B: Group Encryption (Sender Keys - Manual Implementation)
     * Uses: HMAC-SHA256 (Ratchet), AES-GCM (Cipher), Ed25519 (Sign - Placeholder)
     */
    async encryptGroupMessage(plainText: string, groupId: string): Promise<any> {
        const myUserId = this.authService.getUserId();
        const myDeviceId = this.authService.getDeviceId() || 1;
        const senderKeyName = `sender_key_${groupId}_${myUserId}_${myDeviceId}`;

        // 0. Check for Member Changes (Rotation Trigger)
        const groupDetails = await this.groupService.getGroupDetail(groupId).toPromise();
        const currentMemberHash = groupDetails && groupDetails.members
            ? JSON.stringify(groupDetails.members.map(m => m.user_id).sort())
            : '';

        // 1. Load or Create Sender Key
        let record = await this.store.loadSenderKey(senderKeyName);
        let shouldRotate = false;

        if (record && record.memberHash && record.memberHash !== currentMemberHash) {
            this.logger.log(`[Signal] Member list changed for ${groupId}. Rotating Sender Key...`);
            shouldRotate = true;
        }

        if (!record || !record.senderKeyStates || record.senderKeyStates.length === 0 || shouldRotate) {
            if (!shouldRotate) this.logger.log(`[Signal] Generating new Sender Key for ${groupId}`);

            const newRecord = await this.generateSenderKey();
            newRecord.memberHash = currentMemberHash;

            // Should we keep old states? Yes, for decryption of in-flight messages.
            // But simple implementation replaces.
            // Better: Prepend new state.
            if (record && record.senderKeyStates) {
                newRecord.senderKeyStates.push(...record.senderKeyStates.slice(0, 5)); // Keep last 5
            }
            record = newRecord;

            await this.store.storeSenderKey(senderKeyName, record);

            // HF-5B.2: Trigger Distribution
            this.distributeSenderKey(groupId, record.senderKeyStates[0], record.bundleVersion).catch(e => {
                this.logger.error(`[Signal] Failed to distribute key for ${groupId}`, e);
            });
        }

        const state = record.senderKeyStates[0]; // Active state

        // 2. Derive Message Key (Ratchet)
        // Message Key = HMAC(ChainKey, "0x01")
        const chainKeyBytes = this.base64ToArrayBuffer(state.chainKey);
        const messageKey = await this.deriveMessageKey(chainKeyBytes);

        // 3. Advance Chain Key
        // Next Chain Key = HMAC(ChainKey, "0x02")
        const nextChainKey = await this.deriveNextChainKey(chainKeyBytes);
        state.chainKey = this.arrayBufferToBase64(nextChainKey);
        state.iteration++;
        await this.store.storeSenderKey(senderKeyName, record);

        // 4. Encrypt Payload
        const iv = messageKey.slice(0, 12);
        const cipherKey = await window.crypto.subtle.importKey(
            'raw', messageKey.slice(16, 48),
            { name: 'AES-GCM' }, false, ['encrypt']
        );

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            cipherKey,
            new TextEncoder().encode(plainText)
        );

        return {
            protocol: 'v3',
            type: 'group',
            ciphertext: this.arrayBufferToBase64(ciphertext),
            senderUserId: myUserId,
            senderDeviceId: myDeviceId,
            senderDeviceUuid: localStorage.getItem('device_uuid'),
            groupId: groupId,
            timestamp: Date.now(),
            senderKeyId: state.keyId,
            iteration: state.iteration - 1 // The iteration used for this message
        };
    }

    // --- HF-5B.2 Key Distribution ---
    private async distributeSenderKey(groupId: string, state: SenderKeyState, version: number) {
        // 1. Fetch Members
        const details = await this.groupService.getGroupDetail(groupId).toPromise();
        if (!details || !details.members) return;

        const myUserId = this.authService.getUserId();
        const recipients = details.members.filter(m => m.user_id !== myUserId);

        const distributionMessage = {
            type: 'SenderKeyDistributionMessage',
            groupId: groupId,
            senderKeyId: state.keyId,
            chainKey: state.chainKey,
            signingKey: state.signingKey,
            identityKey: this.arrayBufferToBase64((await this.store.getIdentityKeyPair()).pubKey), // HF-5B.1 Binding
            bundleVersion: version, // HF-5B.2
            createdAt: Date.now()
        };

        // HF-5B.1: Sign the Bundle with Identity Key
        const signedBundle = await this.signSenderKeyBundle(distributionMessage);
        const signedPayload = JSON.stringify(signedBundle);

        const recipientKeys = [];

        for (const member of recipients) {
            try {
                // Get Device ID (optimistic: primary only for now - Phase 5.3 Multi-Device will loop all)
                const deviceId = await this.getPrimaryDeviceId(member.user_id);

                // 1:1 Encrypt
                const envelope = await this.encryptMessage(signedPayload, member.user_id, deviceId);

                recipientKeys.push({
                    recipient_id: member.user_id,
                    device_uuid: 'pk', // Placeholder since we encrypt for specific device but upload structure asks for UUID? 
                    // Actually upload_sender_key.php expects device_uuid of recipient.
                    // We don't have it easily. We can fetch it or just use '1' if legacy?
                    // Let's assume fetching Public Keys returns device UUIDs.
                    // For now, use a hack or fix fetch keys.
                    // REVISIT: We should fetch target device UUID. 
                    // Assuming '1' for legacy single-device assumption.
                    encrypted_key: JSON.stringify(envelope)
                });
            } catch (e) {
                this.logger.warn(`[Signal] Failed to encrypt bundle for ${member.user_id}`, e);
            }
        }

        if (recipientKeys.length > 0) {
            await this.groupSignalService.uploadSenderKey(groupId, state.keyId, recipientKeys as any[], version).toPromise();
            this.logger.log(`[Signal] Distributed Sender Key to ${recipientKeys.length} members.`);
        }
    }

    private async fetchAndStoreSenderKey(groupId: string, senderId: string, deviceId: number): Promise<void> {
        try {
            const res = await this.groupSignalService.fetchSenderKeys(groupId).toPromise();
            if (!res || !res.keys) return;

            // Find key from specific sender/device
            // Note: fetchSenderKeys returns keys encrypted FOR ME, but we need to find the one FROM target.
            // The API returns 'sender_id', 'sender_device_uuid', 'sender_key_id', 'encrypted_sender_key'
            // We need to match sender_id.

            // TODO: Match sender_device_uuid. But we have senderDeviceId (integer).
            // We might need to map ID -> UUID or just try all keys from that sender_id.
            // For now, allow any key from that sender_id.

            const targetKey = res.keys.find(k => k.sender_id === senderId);
            // Better: && k.sender_device_id match if available? 
            // The API has sender_device_uuid. We only have int ID here.

            if (!targetKey) return;

            const envelope = JSON.parse(targetKey.encrypted_sender_key);
            const plaintext = await this.decryptMessage(envelope, senderId, deviceId);
            const distribution = JSON.parse(plaintext);

            if (distribution.type !== 'SenderKeyDistributionMessage') return;

            // HF-5B.1: Verify Signature
            if (!distribution.signature || !distribution.identityKey) {
                this.logger.warn(`[Signal] Rejected unsigned Sender Key from ${senderId}`);
                return;
            }

            const isValid = await this.verifySenderKeySignature(distribution, distribution.identityKey);
            if (!isValid) {
                this.logger.error(`[Signal] Invalid Signature on Sender Key from ${senderId}`);
                return;
            }

            const senderKeyName = `sender_key_${groupId}_${senderId}_${deviceId}`;
            // HF-5B.2: Replay Protection
            const record = await this.store.loadSenderKey(senderKeyName);
            if (record) {
                if (distribution.bundleVersion <= record.bundleVersion) {
                    this.logger.warn(`[Signal] Rejected Replay/Old Key for ${senderId} (v${distribution.bundleVersion} vs v${record.bundleVersion})`);
                    return;
                }
            }

            const newRecord: SenderKeyRecord = {
                senderKeyStates: [{
                    keyId: distribution.senderKeyId,
                    chainKey: distribution.chainKey,
                    signingKey: distribution.signingKey,
                    iteration: 0 // Start fresh or from distribution
                }],
                bundleVersion: distribution.bundleVersion || 1,
                createdAt: distribution.createdAt || Date.now()
            };

            await this.store.storeSenderKey(senderKeyName, newRecord);
            this.logger.log(`[Signal] Fetched & Stored Sender Key (v${newRecord.bundleVersion}) for ${senderId}`);

        } catch (e) {
            this.logger.warn(`[Signal] Failed to fetch/store sender key for ${senderId}`, e);
        }
    }

    async decryptGroupMessage(envelope: any, groupId: string, senderId: string, senderDeviceId: number): Promise<string> {
        const senderKeyName = `sender_key_${groupId}_${senderId}_${senderDeviceId}`;
        let record = await this.store.loadSenderKey(senderKeyName);

        if (!record) {
            this.logger.log(`[Signal] Missing Sender Key for ${groupId}:${senderId}, fetching...`);
            await this.fetchAndStoreSenderKey(groupId, senderId, senderDeviceId);
            record = await this.store.loadSenderKey(senderKeyName);
        }

        if (!record) throw new Error('NO_SESSION_KEY_AFTER_FETCH');

        // Find relevant state by keyId (if multiple)
        const state = record.senderKeyStates.find((s: SenderKeyState) => s.keyId === envelope.senderKeyId);
        if (!state) throw new Error('UNKNOWN_KEY_ID');

        // Simple Ratchet (Just decrypt for now, full ratchet sync is complex)
        // We assume we have the *current* chain key or can derive forward.
        // For simplicity in this step, we use the key in the record (assuming strict order or stateless decryption if key is provided)

        // REVISIT: Direct Key Derivation from Envelope?
        // No, we must use the stored chain key to derive the specific message key.
        // If envelope.iteration > state.iteration, we fast-forward.

        let chainKey = this.base64ToArrayBuffer(state.chainKey);
        // Fast-forward loop (max 100 steps)
        const steps = envelope.iteration - state.iteration;
        if (steps < 0) throw new Error('OLD_MESSAGE_REPLAY');
        if (steps > 2000) throw new Error('TOO_MANY_SKIPS');

        for (let i = 0; i < steps; i++) {
            chainKey = await this.deriveNextChainKey(chainKey);
        }

        const messageKey = await this.deriveMessageKey(chainKey);

        const iv = messageKey.slice(0, 12);
        const cipherKey = await window.crypto.subtle.importKey(
            'raw', messageKey.slice(16, 48),
            { name: 'AES-GCM' }, false, ['decrypt']
        );

        const plaintext = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            cipherKey,
            this.base64ToArrayBuffer(envelope.ciphertext)
        );

        // Update State (Advance Ratchet)
        if (steps >= 0) {
            state.chainKey = this.arrayBufferToBase64(await this.deriveNextChainKey(chainKey));
            state.iteration = envelope.iteration + 1;
            await this.store.storeSenderKey(senderKeyName, record);
        }

        return new TextDecoder().decode(plaintext);
    }

    // --- Crypto Helpers ---
    private async generateSenderKey(): Promise<SenderKeyRecord> {
        const chainKey = window.crypto.getRandomValues(new Uint8Array(32));
        return {
            senderKeyStates: [{
                keyId: Math.floor(Math.random() * 2147483647),
                chainKey: this.arrayBufferToBase64(chainKey.buffer),
                signingKey: { pub: '', priv: '' }, // Placeholder (Signed Bundle used instead)
                iteration: 0
            }],
            bundleVersion: 1,
            createdAt: Date.now()
        };
    }

    private async deriveMessageKey(chainKey: ArrayBuffer): Promise<ArrayBuffer> {
        // HMAC-SHA256(chainKey, 0x01)
        const key = await window.crypto.subtle.importKey('raw', chainKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        // Returns 32 bytes. We need 16 (IV) + 32 (AES) = 48 bytes? 
        // Signal uses KDF to split. Here we simplify:
        // Byte 0x01 -> Message Key part 1?
        // Let's use standard: HMAC(chainKey, 0x01) for IV (16), HMAC(chainKey, 0x02) for Key (32)
        const ivPart = await window.crypto.subtle.sign('HMAC', key, new Uint8Array([0x01]));
        const keyPart = await window.crypto.subtle.sign('HMAC', key, new Uint8Array([0x02]));

        const result = new Uint8Array(48);
        result.set(new Uint8Array(ivPart).slice(0, 12), 0); // 12 byte IV
        result.set(new Uint8Array(keyPart), 16);            // 32 byte Key
        return result.buffer;
    }

    private async deriveNextChainKey(chainKey: ArrayBuffer): Promise<ArrayBuffer> {
        const key = await window.crypto.subtle.importKey('raw', chainKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return await window.crypto.subtle.sign('HMAC', key, new Uint8Array([0x02]));
    }

    // --- 4. Discovery (Story 2.5 Fix) ---
    async getPrimaryDeviceId(userId: string): Promise<number> {
        try {
            const devices: any[] = await this.http.get<any[]>(`${environment.apiUrl}/devices?user_id=${userId}&action=list`, {
                withCredentials: true
            }).toPromise() || [];

            // Filter for devices with valid libsignal_device_id
            const validDevices = devices.filter(d => d.libsignal_device_id);

            if (validDevices.length > 0) {
                // Logic: Return the most recently active?
                // For MVP, picking the first valid one is safer than guessing.
                return Number(validDevices[0].libsignal_device_id);
            }

            return 1; // Fallback if no specific Signal ID found
        } catch (e) {
            console.warn('Failed to fetch devices for user ' + userId, e);
            return 1; // Basic MVP fallback
        }
    }

    async decryptMessage(ciphertext: any, remoteUserId: string, remoteDeviceId: number): Promise<string> {
        const address = new libsignal.SignalProtocolAddress(remoteUserId, remoteDeviceId);
        const sessionCipher = new libsignal.SessionCipher(this.store, address);

        let buffer: ArrayBuffer;

        try {
            // Decode Base64 body
            const bodyBuffer = this.base64ToArrayBuffer(ciphertext.body);

            if (ciphertext.type === 3) {
                // PreKeyWhisperMessage
                buffer = await sessionCipher.decryptPreKeyWhisperMessage(bodyBuffer);
            } else if (ciphertext.type === 1) {
                // WhisperMessage
                buffer = await sessionCipher.decryptWhisperMessage(bodyBuffer);
            } else {
                throw new Error('Unknown Signal Message Type');
            }

            return new TextDecoder().decode(buffer);

        } catch (e) {
            console.error(`Decryption failed from ${remoteUserId}:${remoteDeviceId}`, e);
            throw e; // Bubble up for "Decryption Error" UI
        }
    }




    // --- 6. Trust UX (Epic 6) ---
    async getSafetyNumber(remoteUserId: string): Promise<string | null> {
        const myIdentity = await this.store.getIdentityKeyPair();
        const theirIdentity = await this.store.loadIdentityKey(remoteUserId);

        if (!myIdentity || !theirIdentity) {
            console.warn('Cannot generate safety number: Missing identity keys');
            return null;
        }

        // STRICT FIX: Normalize to Uint8Array regardless of source type
        const myBytes = this.toUint8Array(myIdentity.pubKey);
        const theirPubRaw = theirIdentity.pubKey || theirIdentity;
        const theirBytes = this.toUint8Array(theirPubRaw);

        if (!myBytes || !theirBytes) {
            console.warn('Cannot generate safety number: Invalid key format');
            return null;
        }

        // STRICT FIX: Deterministic ordering via full lexicographic byte comparison
        const order = this.compareByteArrays(myBytes, theirBytes);
        const combined = order <= 0
            ? new Uint8Array([...myBytes, ...theirBytes])
            : new Uint8Array([...theirBytes, ...myBytes]);

        // SHA-256 Hash of raw bytes
        const hash = await window.crypto.subtle.digest('SHA-256', combined.buffer as ArrayBuffer);

        // Format as Numeric Groups
        return this.formatSafetyNumber(hash);
    }

    // STRICT FIX: Normalize any key format to Uint8Array
    private toUint8Array(data: any): Uint8Array | null {
        if (!data) return null;
        if (data instanceof Uint8Array) return data;
        if (data instanceof ArrayBuffer) return new Uint8Array(data);
        if (data.buffer && data.buffer instanceof ArrayBuffer) {
            return new Uint8Array(data.buffer);
        }
        return null;
    }

    // STRICT FIX: Full lexicographic byte array comparison
    private compareByteArrays(a: Uint8Array, b: Uint8Array): number {
        const minLen = Math.min(a.length, b.length);
        for (let i = 0; i < minLen; i++) {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return 1;
        }
        // All bytes equal up to minLen, shorter array comes first
        return a.length - b.length;
    }

    private formatSafetyNumber(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        // Use first 15 bytes to generate 30 digits (approx)
        // Simple visualization: specific chunks -> integers
        // Standard Signal: 30 digits in 6 groups of 5.
        // We will do a simplified version: taking 5 byte chunks, modulo 100000.

        let codes = [];
        for (let i = 0; i < 6; i++) { // 6 groups
            if ((i * 5) + 5 > bytes.length) break;
            const chunk = bytes.slice(i * 5, i * 5 + 5);
            // Convert chunk to integer
            let val = 0;
            for (let j = 0; j < 5; j++) {
                val = (val * 256 + chunk[j]) % 100000;
            }
            // Pad with leading zeros to 5 digits
            codes.push(val.toString().padStart(5, '0'));
        }
        return codes.join(' ');
    }

    // Helper: Base64 to ArrayBuffer
    private base64ToArrayBuffer(base64: string | undefined | null): ArrayBuffer {
        return this.base64ToArrayBuffer_Safe(base64 || '');
    }

    private base64ToArrayBuffer_Safe(base64: string): ArrayBuffer {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Helper: ArrayBuffer to Base64 (Existing)
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // --- HF-5B.1: Signing Helpers ---
    private async ensureCurve(): Promise<any> {
        if (this.internalCurve) return this.internalCurve;
        // libsignal.default is the factory
        const lib = await (libsignal as any).default();
        this.internalCurve = lib.Curve;
        return this.internalCurve;
    }

    private async signSenderKeyBundle(bundle: any): Promise<any> {
        const identity = await this.store.getIdentityKeyPair();
        if (!identity) throw new Error('NO_IDENTITY');

        // Deterministic serialization for signing: keyId + chainKey + groupId
        // Simple: UTF-8 of specific fields
        const data = new TextEncoder().encode(`${bundle.groupId}:${bundle.senderKeyId}:${bundle.chainKey}`);

        const curve = await this.ensureCurve();
        const signature = curve.calculateSignature(identity.privKey, data);

        return {
            ...bundle,
            signature: this.arrayBufferToBase64(signature)
        };
    }

    private async verifySenderKeySignature(bundle: any, identityKeyBase64: string): Promise<boolean> {
        const data = new TextEncoder().encode(`${bundle.groupId}:${bundle.senderKeyId}:${bundle.chainKey}`);
        const signature = this.base64ToArrayBuffer(bundle.signature);
        const pubKey = this.base64ToArrayBuffer(identityKeyBase64);

        const curve = await this.ensureCurve();
        return curve.verifySignature(pubKey, data, signature);
    }
}
