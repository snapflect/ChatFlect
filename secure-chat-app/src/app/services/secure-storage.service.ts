import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Secure Storage Service
 * Security Enhancement #6: Store sensitive data in native Keychain/Keystore
 * 
 * Uses capacitor-secure-storage-plugin for native secure storage on mobile,
 * falls back to encrypted localStorage on web
 */

// Dynamic import for capacitor plugin (may not be installed yet)
let SecureStoragePlugin: any = null;

@Injectable({
    providedIn: 'root'
})
export class SecureStorageService {
    private initialized = false;
    private encryptionKey: CryptoKey | null = null;

    constructor() {
        this.init();
    }

    private async init() {
        if (Capacitor.isNativePlatform()) {
            try {
                // Try to import the secure storage plugin
                const module = await import('capacitor-secure-storage-plugin');
                SecureStoragePlugin = module.SecureStoragePlugin;
                this.initialized = true;
            } catch (e) {
                console.warn('Secure storage plugin not available, using encrypted localStorage fallback');
                await this.initWebFallback();
            }
        } else {
            await this.initWebFallback();
        }
    }

    /**
     * Initialize web fallback with derived encryption key
     */
    private async initWebFallback() {
        // Derive a key from a device fingerprint (simplified - in production use better entropy)
        const fingerprint = this.getDeviceFingerprint();
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(fingerprint),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        this.encryptionKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('ChatFlect_SecureStorage_Salt'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        this.initialized = true;
    }

    /**
     * Get a simple device fingerprint for key derivation
     */
    private getDeviceFingerprint(): string {
        const nav = navigator;
        return [
            nav.userAgent,
            nav.language,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ].join('|');
    }

    /**
     * Store a value securely
     */
    async setItem(key: string, value: string): Promise<void> {
        await this.waitForInit();

        if (SecureStoragePlugin) {
            // Native secure storage
            await SecureStoragePlugin.set({ key, value });
        } else {
            // Web fallback with encryption
            const encrypted = await this.encryptValue(value);
            localStorage.setItem(`secure_${key}`, encrypted);
        }
    }

    /**
     * Retrieve a securely stored value
     */
    async getItem(key: string): Promise<string | null> {
        await this.waitForInit();

        if (SecureStoragePlugin) {
            try {
                const result = await SecureStoragePlugin.get({ key });
                return result.value;
            } catch (e) {
                return null;
            }
        } else {
            // Web fallback
            const encrypted = localStorage.getItem(`secure_${key}`);
            if (!encrypted) return null;

            try {
                return await this.decryptValue(encrypted);
            } catch (e) {
                console.error('Failed to decrypt secure storage value:', e);
                return null;
            }
        }
    }

    /**
     * Remove a securely stored value
     */
    async removeItem(key: string): Promise<void> {
        await this.waitForInit();

        if (SecureStoragePlugin) {
            try {
                await SecureStoragePlugin.remove({ key });
            } catch (e) {
                // Key might not exist
            }
        } else {
            localStorage.removeItem(`secure_${key}`);
        }
    }

    /**
     * Clear all secure storage
     */
    async clear(): Promise<void> {
        await this.waitForInit();

        if (SecureStoragePlugin) {
            await SecureStoragePlugin.clear();
        } else {
            // Remove all secure_ prefixed keys
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('secure_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
    }

    /**
     * Wait for initialization to complete
     */
    private async waitForInit(): Promise<void> {
        let attempts = 0;
        while (!this.initialized && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (!this.initialized) {
            throw new Error('Secure storage failed to initialize');
        }
    }

    /**
     * Encrypt a value for web storage
     */
    private async encryptValue(value: string): Promise<string> {
        if (!this.encryptionKey) throw new Error('Encryption key not initialized');

        const encoder = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this.encryptionKey,
            encoder.encode(value)
        );

        // Combine IV and ciphertext
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    /**
     * Decrypt a value from web storage
     */
    private async decryptValue(encryptedBase64: string): Promise<string> {
        if (!this.encryptionKey) throw new Error('Encryption key not initialized');

        const combined = new Uint8Array(
            atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
        );

        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            this.encryptionKey,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    }
}
