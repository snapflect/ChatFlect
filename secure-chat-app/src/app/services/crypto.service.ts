import { Injectable } from '@angular/core';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class CryptoService {

    constructor(private logger: LoggingService) { }

    // --- Utils ---
    private ab2str(buf: ArrayBuffer): string {
        return String.fromCharCode.apply(null, new Uint8Array(buf) as any);
    }

    private str2ab(str: string): ArrayBuffer {
        const buf = new ArrayBuffer(str.length);
        const bufView = new Uint8Array(buf);
        for (let i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

    public arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    public base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // --- RSA Key Management --- //

    async generateKeyPair(): Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }> {
        return window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        ) as Promise<CryptoKeyPair>;
    }

    async exportKey(key: CryptoKey): Promise<string> {
        const exported = await window.crypto.subtle.exportKey(
            key.type === "public" ? "spki" : "pkcs8",
            key
        );
        return this.arrayBufferToBase64(exported);
    }

    async importKey(keyStr: string, type: "public" | "private"): Promise<CryptoKey> {
        const binaryDer = this.base64ToArrayBuffer(keyStr);
        return window.crypto.subtle.importKey(
            type === "public" ? "spki" : "pkcs8",
            binaryDer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256",
            },
            true,
            [type === "public" ? "encrypt" : "decrypt"]
        );
    }

    // --- Encryption Flow (Hybrid) --- //

    // 1. Generate AES Session Key
    async generateSessionKey(): Promise<CryptoKey> {
        return window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // 2. Encrypt Message with Session Key
    async encryptData(data: string, sessionKey: CryptoKey): Promise<{ iv: string, cipherText: string }> {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(data);

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            sessionKey,
            encodedData
        );

        return {
            iv: this.arrayBufferToBase64(iv.buffer),
            cipherText: this.arrayBufferToBase64(encrypted)
        };
    }

    // 3. Encrypt Session Key with Recipient's Public RSA Key
    async encryptSessionKey(sessionKey: CryptoKey, recipientPublicKey: CryptoKey): Promise<string> {
        const exportedSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);
        const encryptedKey = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            recipientPublicKey,
            exportedSessionKey
        );
        return this.arrayBufferToBase64(encryptedKey);
    }

    // FULL SEND: Encrypt text for a recipient
    async encryptMessage(text: string, recipientPublicKeyStr: string): Promise<string> {
        try {
            const recipientPubKey = await this.importKey(recipientPublicKeyStr, 'public');
            const sessionKey = await this.generateSessionKey();

            const { iv, cipherText } = await this.encryptData(text, sessionKey);
            const encryptedSessionKey = await this.encryptSessionKey(sessionKey, recipientPubKey);

            // Package format: JSON
            const packageObj = {
                k: encryptedSessionKey, // Encrypted Session Key
                i: iv,                 // IV for AES
                d: cipherText          // Encrypted Data
            };

            return JSON.stringify(packageObj);
        } catch (e) {
            this.logger.error("Encryption Failed", e);
            return "";
        }
    }

    // --- Decryption Flow --- //

    async decryptMessage(packageStr: string, myPrivateKeyStr: string): Promise<string> {
        try {
            const pkg = JSON.parse(packageStr);
            const myPrivKey = await this.importKey(myPrivateKeyStr, 'private');

            // 1. Decrypt Session Key
            const encSessionKeyReq = this.base64ToArrayBuffer(pkg.k);
            const sessionKeyRaw = await window.crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                myPrivKey,
                encSessionKeyReq
            );

            // Import Session Key
            const sessionKey = await window.crypto.subtle.importKey(
                "raw",
                sessionKeyRaw,
                { name: "AES-GCM" },
                true,
                ["encrypt", "decrypt"]
            );

            // 2. Decrypt Data
            const iv = this.base64ToArrayBuffer(pkg.i);
            const cipherText = this.base64ToArrayBuffer(pkg.d);

            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: new Uint8Array(iv)
                },
                sessionKey,
                cipherText
            );

            return new TextDecoder().decode(decrypted);

        } catch (e) {
            this.logger.error("Decryption Failed", e);
            return "[Decryption Error]";
        }
    }

    // --- File Encryption (Blob) --- //

    async encryptBlob(blob: Blob): Promise<{ encryptedBlob: Blob, key: CryptoKey, iv: Uint8Array }> {
        const key = await this.generateSessionKey();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const arrayBuffer = await blob.arrayBuffer();

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv as any },
            key,
            arrayBuffer
        );

        return {
            encryptedBlob: new Blob([encryptedBuffer]),
            key: key,
            iv: iv
        };
    }

    async decryptBlob(encryptedBlob: Blob, key: CryptoKey, iv: Uint8Array): Promise<Blob> {
        const arrayBuffer = await encryptedBlob.arrayBuffer();

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as any },
            key,
            arrayBuffer
        );

        return new Blob([decryptedBuffer]);
    }
}
