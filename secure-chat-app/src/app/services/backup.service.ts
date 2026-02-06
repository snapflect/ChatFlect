import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';

@Injectable({
    providedIn: 'root'
})
export class BackupService {

    constructor(
        private api: ApiService,
        private auth: AuthService,
        private crypto: CryptoService
    ) { }

    /**
     * SECURITY FIX (H2): Encrypted Backup Export
     * Replaces plaintext JSON export with PBKDF2 + AES-256-GCM encryption.
     */
    async createBackup(password: string): Promise<Blob> {
        if (!password || password.length < 8) {
            throw new Error("Password must be at least 8 characters");
        }

        // 1. Gather Data
        const data: any = {
            version: 2, // Bump version
            date: new Date().toISOString(),
            keys: {
                private_key: localStorage.getItem('private_key'),
                public_key: localStorage.getItem('public_key'),
                user_id: localStorage.getItem('user_id'),
                firstName: localStorage.getItem('firstName'),
                lastName: localStorage.getItem('lastName'),
                photoUrl: localStorage.getItem('photoUrl'),
                identity_key: localStorage.getItem('identity_key') // include identity key
            }
        };

        const plaintext = new TextEncoder().encode(JSON.stringify(data));

        // 2. Generate Salt & IV
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // 3. Import Key & Derive
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        const key = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000, // OWASP recommendation
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );

        // 4. Encrypt
        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            plaintext
        );

        // 5. Pack Blob: Salt (16) + IV (12) + Ciphertext
        return new Blob([salt, iv, ciphertext], { type: "application/octet-stream" });
    }

    async restoreBackup(file: File, password: string): Promise<boolean> {
        try {
            const buffer = await file.arrayBuffer();

            // 1. Extract Salt & IV
            const salt = buffer.slice(0, 16);
            const iv = buffer.slice(16, 28);
            const ciphertext = buffer.slice(28);

            // 2. Derive Key
            const keyMaterial = await window.crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(password),
                { name: "PBKDF2" },
                false,
                ["deriveKey"]
            );

            const key = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );

            // 3. Decrypt
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                ciphertext
            );

            const jsonString = new TextDecoder().decode(decryptedBuffer);
            const data = JSON.parse(jsonString);

            if (!data.keys || !data.keys.private_key) {
                throw new Error("Invalid Backup Format");
            }

            // 4. Restore Keys
            localStorage.setItem('private_key', data.keys.private_key);
            localStorage.setItem('public_key', data.keys.public_key);
            localStorage.setItem('user_id', data.keys.user_id);

            if (data.keys.firstName) localStorage.setItem('firstName', data.keys.firstName);
            if (data.keys.lastName) localStorage.setItem('lastName', data.keys.lastName);
            if (data.keys.photoUrl) localStorage.setItem('photoUrl', data.keys.photoUrl);
            if (data.keys.identity_key) localStorage.setItem('identity_key', data.keys.identity_key);

            return true;
        } catch (e) {
            console.error("Restore failed - likely wrong password", e);
            throw new Error("Decryption failed. Wrong password?");
        }
    }
}
