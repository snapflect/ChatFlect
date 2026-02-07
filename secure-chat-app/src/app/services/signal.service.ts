import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SignalStoreService } from './signal-store.service';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SignalService {
    private store: SignalStoreService;

    constructor(
        private http: HttpClient,
        store: SignalStoreService,
        private authService: AuthService
    ) {
        this.store = store;
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

    async encryptMessage(plaintext: string, remoteUserId: string, remoteDeviceId: number): Promise<any> {
        const address = new libsignal.SignalProtocolAddress(remoteUserId, remoteDeviceId);
        const sessionCipher = new libsignal.SessionCipher(this.store, address);

        // Ensure session exists or allow auto-init? Ideally caller ensures session.
        // But for robustness:
        if (!(await this.store.loadSession(address.toString()))) {
            await this.establishSession(remoteUserId, remoteDeviceId);
        }

        const copy = new TextEncoder().encode(plaintext).buffer;
        const ciphertext = await sessionCipher.encrypt(copy);

        const myDeviceId = this.authService.getDeviceId() || 1;
        const myUserId = this.authService.getUserId(); // Ensure this exists

        return {
            type: ciphertext.type, // 3 (PreKeyBundle) or 1 (Whisper)
            body: this.arrayBufferToBase64(ciphertext.body),
            registrationId: ciphertext.registrationId,
            senderUserId: myUserId,
            senderDeviceId: myDeviceId,
            receiverUserId: remoteUserId,
            receiverDeviceId: remoteDeviceId,
            timestamp: Date.now(),
            version: 3,
            messageType: ciphertext.type === 3 ? 'PREKEY' : 'WHISPER'
        };
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

        // STRICT FIX: Deterministic sorting by raw bytes, not base64
        // Compare first byte to determine order (consistent on both sides)
        let combined: Uint8Array;
        if (myBytes[0] < theirBytes[0]) {
            combined = new Uint8Array([...myBytes, ...theirBytes]);
        } else if (myBytes[0] > theirBytes[0]) {
            combined = new Uint8Array([...theirBytes, ...myBytes]);
        } else {
            // First bytes equal, compare lexicographically
            const myStr = this.arrayBufferToBase64(myBytes.buffer as ArrayBuffer);
            const theirStr = this.arrayBufferToBase64(theirBytes.buffer as ArrayBuffer);
            combined = myStr < theirStr
                ? new Uint8Array([...myBytes, ...theirBytes])
                : new Uint8Array([...theirBytes, ...myBytes]);
        }

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
}
