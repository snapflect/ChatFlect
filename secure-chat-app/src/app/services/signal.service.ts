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

    // --- 1. Registration Flow ---
    async register(): Promise<void> {
        // 1. Generate Identity Key Pair
        const registrationId = libsignal.KeyHelper.generateRegistrationId();
        const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();

        // 2. Generate Signed PreKey (Rotate ID)
        const signedPreKeyId = await this.store.getNextSignedPreKeyId();
        const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);

        // 3. Generate One-Time PreKeys (Batch of 100)
        const count = 100;
        const startId = await this.store.reservePreKeyIds(count);
        const preKeys = [];
        for (let i = 0; i < count; i++) {
            const keyId = startId + i;
            const key = await libsignal.KeyHelper.generatePreKey(keyId);
            preKeys.push(key);
        }

        // 4. Store Locally
        await this.store.setLocalIdentity(identityKeyPair, registrationId);
        await this.store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
        for (const key of preKeys) {
            await this.store.storePreKey(key.keyId, key.keyPair);
        }

        const deviceId = this.authService.getDeviceId() || 1; // Strict: Get from Auth
        const keyVersion = 1; // Story 3.1: Initial Version

        // 5. Upload to Backend
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
            keyVersion: keyVersion // Story 3.1
        };

        // Authenticated HTTP Upload
        try {
            await this.http.post(`${environment.apiUrl}/keys`, bundle, {
                withCredentials: true
            }).toPromise();

            // Story 3.1: Store initialized version
            await this.store.setLocalKeyVersion(keyVersion);

            console.log('Keys uploaded successfully');
        } catch (e) {
            console.error('Registration failed at backend', e);
            // Rollback? For now just throw.
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

    // Helper: Base64 to ArrayBuffer
    private base64ToArrayBuffer(base64: string | undefined | null): ArrayBuffer {
        if (!base64) return new ArrayBuffer(0);
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
