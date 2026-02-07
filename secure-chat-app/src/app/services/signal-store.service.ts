import { Injectable } from '@angular/core';
import { get, set, del, keys, clear } from 'idb-keyval';
import { SecureStorageService } from './secure-storage.service';

export interface SignalProtocolStore {
    getIdentityKeyPair(): Promise<any>;
    getLocalRegistrationId(): Promise<number>;
    saveIdentity(identifier: string, identityKey: any): Promise<boolean>;
    loadIdentityKey(identifier: string): Promise<any>;
    loadPreKey(keyId: string | number): Promise<any>;
    storePreKey(keyId: string | number, keyPair: any): Promise<void>;
    loadSignedPreKey(keyId: string | number): Promise<any>;
    storeSignedPreKey(keyId: string | number, keyPair: any): Promise<void>;
    loadSession(identifier: string): Promise<any>;
    storeSession(identifier: string, record: any): Promise<void>;
    removePreKey(keyId: string | number): Promise<void>;
    removeSignedPreKey(keyId: string | number): Promise<void>;
    removeAllPreKeys(): Promise<void>;
}

@Injectable({
    providedIn: 'root'
})
export class SignalStoreService implements SignalProtocolStore {
    private encryptionKey: CryptoKey | null = null;
    private readonly IV_LENGTH = 12;
    private initPromise: Promise<void> | null = null;

    constructor(private secureStorage: SecureStorageService) { }

    private async initEncryption(): Promise<void> {
        if (this.encryptionKey) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                let rawKeyStr = await this.secureStorage.getItem('signal_aes_key');

                if (!rawKeyStr) {
                    const key = await window.crypto.subtle.generateKey(
                        { name: "AES-GCM", length: 256 },
                        true,
                        ["encrypt", "decrypt"]
                    );
                    const exported = await window.crypto.subtle.exportKey("raw", key);
                    rawKeyStr = this.arrayBufferToBase64(exported);
                    await this.secureStorage.setItem('signal_aes_key', rawKeyStr);
                }

                const keyBuffer = this.base64ToArrayBuffer(rawKeyStr);
                this.encryptionKey = await window.crypto.subtle.importKey(
                    "raw",
                    keyBuffer,
                    { name: "AES-GCM" },
                    false,
                    ["encrypt", "decrypt"]
                );
            } catch (e) {
                console.error('CRITICAL: Failed to init Signal Encryption', e);
                throw e;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    // --- Helpers: Encrypt/Decrypt ---
    private async encryptData(data: any): Promise<any> {
        if (!this.encryptionKey) await this.initEncryption();
        if (!this.encryptionKey) throw new Error("Encryption Key not initialized");

        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            this.encryptionKey,
            encoded
        );

        return {
            iv: this.arrayBufferToBase64(iv.buffer),
            data: this.arrayBufferToBase64(ciphertext)
        };
    }

    private async decryptData(encrypted: any): Promise<any> {
        if (!encrypted) return null;
        if (!encrypted.iv || !encrypted.data) return encrypted; // Handle legacy/plaintext

        if (!this.encryptionKey) await this.initEncryption();
        if (!this.encryptionKey) throw new Error("Encryption Key not initialized");

        try {
            const iv = this.base64ToArrayBuffer(encrypted.iv);
            const data = this.base64ToArrayBuffer(encrypted.data);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                this.encryptionKey,
                data
            );
            return JSON.parse(new TextDecoder().decode(decrypted));
        } catch (e) {
            console.error("Decryption failed", e);
            return null;
        }
    }

    // --- ID Generation ---
    async getNextPreKeyId(): Promise<number> {
        return this.reservePreKeyIds(1);
    }

    async reservePreKeyIds(count: number): Promise<number> {
        const current = (await get('nextPreKeyId')) || 1;
        await set('nextPreKeyId', current + count);
        return current;
    }

    async getNextSignedPreKeyId(): Promise<number> {
        const current = (await get('nextSignedPreKeyId')) || 1;
        await set('nextSignedPreKeyId', current + 1);
        return current;
    }

    // --- Identity Key (Encrypted) ---
    async getIdentityKeyPair(): Promise<any> {
        const data = await get('identityKey');
        return this.decryptData(data);
    }

    async getLocalRegistrationId(): Promise<number> {
        return await get('registrationId');
    }

    async saveIdentity(identifier: string, identityKey: any): Promise<boolean> {
        const encrypted = await this.encryptData(identityKey);
        await set(`identityKey_${identifier}`, encrypted);
        return true;
    }

    async isTrustedIdentity(identifier: string, identityKey: any, direction: any): Promise<boolean> {
        const existing = await get(`identityKey_${identifier}`);
        if (!existing) {
            await this.saveIdentity(identifier, identityKey);
            return true;
        }

        const storedKey = await this.loadIdentityKey(identifier);
        if (!storedKey) return true;

        const existingPub = storedKey.pubKey || storedKey;
        const newPub = identityKey.pubKey || identityKey;

        if (!this.isArrayBufferEqual(existingPub, newPub)) {
            console.warn(`SECURITY WARNING: Untrusted Identity Key for ${identifier}. Possible MITM.`);
            return false;
        }

        return true;
    }

    private isArrayBufferEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
        if (a.byteLength !== b.byteLength) return false;
        const dv1 = new Uint8Array(a);
        const dv2 = new Uint8Array(b);
        for (let i = 0; i < a.byteLength; i++) {
            if (dv1[i] !== dv2[i]) return false;
        }
        return true;
    }

    async loadIdentityKey(identifier: string): Promise<any> {
        const encrypted = await get(`identityKey_${identifier}`);
        if (!encrypted) return null;
        return this.decryptData(encrypted);
    }

    // Helpers: Base64/ArrayBuffer
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
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

    // --- PreKeys (One-Time) ---
    async getPreKey(keyId: string | number): Promise<any> {
        return this.loadPreKey(keyId);
    }

    async loadPreKey(keyId: string | number): Promise<any> {
        const res = await get(`preKey_${keyId}`);
        return res ? res : undefined;
    }

    async storePreKey(keyId: string | number, keyPair: any): Promise<void> {
        await set(`preKey_${keyId}`, keyPair);
    }

    async removePreKey(keyId: string | number): Promise<void> {
        await del(`preKey_${keyId}`);
    }

    async removeAllPreKeys(): Promise<void> {
        await clear();
    }

    // --- Story 3.1: Key Versioning Support ---
    async getLocalKeyVersion(): Promise<number> {
        try {
            const v = await get('local_key_version');
            return v ? Number(v) : 1;
        } catch (e) {
            return 1;
        }
    }

    async setLocalKeyVersion(version: number): Promise<void> {
        await set('local_key_version', version);
    }

    // --- Signed PreKeys ---
    async getSignedPreKey(keyId: string | number): Promise<any> {
        return this.loadSignedPreKey(keyId);
    }

    async loadSignedPreKey(keyId: string | number): Promise<any> {
        const res = await get(`signedPreKey_${keyId}`);
        return res ? res : undefined;
    }

    async storeSignedPreKey(keyId: string | number, keyPair: any): Promise<void> {
        await set(`signedPreKey_${keyId}`, keyPair);
    }

    async removeSignedPreKey(keyId: string | number): Promise<void> {
        await del(`signedPreKey_${keyId}`);
    }

    // --- Sessions ---
    async getSession(identifier: string): Promise<any> {
        return this.loadSession(identifier);
    }

    async loadSession(identifier: string): Promise<any> {
        const encrypted = await get(`session_${identifier}`);
        return encrypted ? this.decryptData(encrypted) : undefined;
    }

    async storeSession(identifier: string, record: any): Promise<void> {
        const encrypted = await this.encryptData(record);
        await set(`session_${identifier}`, encrypted);
    }

    async removeSession(identifier: string): Promise<void> {
        await del(`session_${identifier}`);
    }

    async deleteSession(identifier: string): Promise<void> {
        await this.removeSession(identifier);
    }

    // --- Identity Management ---
    async removeIdentity(identifier: string): Promise<void> {
        await del(`identityKey_${identifier}`);
    }

    async deleteAllSessions(): Promise<void> {
        const allKeys = await keys();
        const sessions = allKeys.filter((k: any) => String(k).startsWith('session_'));
        for (const k of sessions) {
            await del(k);
        }
    }

    async setLocalIdentity(identityKeyPair: any, registrationId: number): Promise<void> {
        const encKey = await this.encryptData(identityKeyPair);
        await set('identityKey', encKey);
        await set('registrationId', registrationId);
    }
}
