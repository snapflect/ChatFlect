import { Injectable } from '@angular/core';
import { SignalStoreService } from './signal-store.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class RotationService {

    private readonly ROTATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

    constructor(
        private store: SignalStoreService,
        private api: ApiService,
        private auth: AuthService,
        private logger: LoggingService
    ) { }

    /**
     * Checks if rotation is needed based on `rotated_at` timestamp.
     * Logic: If never rotated or > 7 days, trigger rotation.
     */
    async checkAndRotateIfNeeded(): Promise<void> {
        try {
            const lastRotated = await this.store.getLastRotationTimestamp(); // Need to add this to Store
            const now = Date.now();

            if (!lastRotated || (now - lastRotated > this.ROTATION_INTERVAL_MS)) {
                this.logger.log('Key Rotation Needed. Initiating...');
                await this.rotateSignedPreKey();
            } else {
                this.logger.log('Key Rotation Not Needed Yet.');
            }
        } catch (e) {
            this.logger.error('Failed to check/rotate keys', e);
        }
    }

    /**
     * strict: rotated_at field in user_devices (Backend) matches this logic.
     */
    async rotateSignedPreKey(): Promise<void> {
        try {
            const identityKeyPair = await this.store.getIdentityKeyPair();
            if (!identityKeyPair) {
                throw new Error("No Identity Key found. Cannot rotate.");
            }

            // 1. Generate New Signed PreKey
            // We use timestamp or strictly incrementing ID? LibSignal uses integer IDs.
            // We should get max ID from store or just random?
            // Proper way: Store maxSignedPreKeyId locally.
            // For MVP: Time-based ID mod int32 might collide, but safe enough if rare.
            // Better: Load all and find max.

            // Let's assume we store nextSignedPreKeyId in store.
            let nextId = await this.store.getNextSignedPreKeyId();
            const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, nextId);

            // 2. Increment Key Version
            const currentVersion = await this.store.getLocalKeyVersion();
            const newVersion = currentVersion + 1;

            const deviceId = this.auth.getDeviceId();
            if (!deviceId) throw new Error("No Device ID avail");

            // 3. Prepare Payload (Strict Request)
            const payload = {
                deviceId: deviceId,
                keyVersion: newVersion,
                signedPreKey: {
                    keyId: nextId,
                    publicKey: this.arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                    signature: this.arrayBufferToBase64(signedPreKey.signature)
                }
            };

            // STRICT: Sign the *raw* JSON string
            const rawBody = JSON.stringify(payload);
            const signature = await this.signRequest(identityKeyPair.privKey, rawBody);

            // 4. Upload with Signature Header
            const res: any = await this.api.post(
                'v3/rotate_signed_prekey.php',
                payload,
                false, // reportProgress
                { 'X-Signal-Signature': signature } // Headers
            ).toPromise();

            // ... (rest of method)

        } catch (e: any) {
            this.logger.error('Rotation Failed', e);
            throw e;
        }
    }

    async signRequest(privKey: ArrayBuffer, message: string): Promise<string> {
        // Use libsignal Curve (Ed25519) for signing
        // @ts-ignore
        const signature = await libsignal.Curve.calculateSignature(privKey, new TextEncoder().encode(message));
        return this.arrayBufferToBase64(signature);
    }





    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * Story 3.3: Sync Rotation Timestamp from Server
     * This ensures local state matches backend truth (preventing spam).
     */
    async syncRotationTimestampFromServer(deviceId: number): Promise<void> {
        try {
            const res: any = await this.api.get(`v3/get_rotation_history.php?deviceId=${deviceId}`).toPromise();
            if (res && res.history && res.history.length > 0) {
                const last = res.history[0]; // Ordered by DESC
                if (last.rotated_at) {
                    const serverTs = new Date(last.rotated_at).getTime();
                    await this.store.setLastRotationTimestamp(serverTs);
                    this.logger.log(`Synced rotation timestamp from server: ${last.rotated_at}`);
                }
            }
        } catch (e) {
            this.logger.error('Failed to sync rotation history', e);
        }
    }
}
