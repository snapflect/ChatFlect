import { Injectable } from '@angular/core';

/**
 * Storage Key Derivation Function (KDF)
 * Derives distinct keys for different storage contexts from a master key.
 * Uses HKDF-SHA256.
 */
@Injectable({
    providedIn: 'root'
})
export class StorageKDFService {
    private masterKey: CryptoKey | null = null;
    private readonly SALT = new TextEncoder().encode('SnapFlect_Storage_Salt_v1');

    constructor() { }

    async init(masterKeyData: ArrayBuffer): Promise<void> {
        this.masterKey = await window.crypto.subtle.importKey(
            'raw',
            masterKeyData,
            'HKDF',
            false,
            ['deriveKey']
        );
    }

    async deriveStorageKey(context: 'messages' | 'sessions' | 'registry' | 'attachments'): Promise<CryptoKey> {
        if (!this.masterKey) throw new Error('StorageKDF not initialized');

        const info = new TextEncoder().encode(`SnapFlect_Storage_${context}`);
        return window.crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: this.SALT,
                info: info
            },
            this.masterKey,
            { name: 'AES-GCM', length: 256 },
            false, // Storage keys are not exportable
            ['encrypt', 'decrypt']
        );
    }
}
