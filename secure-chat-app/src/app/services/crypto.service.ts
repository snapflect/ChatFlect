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

    // --- Phase 8: Signal Protocol Parity (Double Ratchet Primitives) --- //

    // 1. HKDF (RFC 5869) - Extract and Expand using HMAC-SHA256

    private async hmacSha256(key: CryptoKey, data: BufferSource): Promise<ArrayBuffer> {
        return window.crypto.subtle.sign("HMAC", key, data);
    }

    private async importHmacKey(rawKey: BufferSource): Promise<CryptoKey> {
        return window.crypto.subtle.importKey(
            "raw",
            rawKey,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
    }

    // HKDF Extract: PRK = HMAC-Hash(salt, IKM)
    async hkdfExtract(salt: BufferSource | null, ikm: BufferSource): Promise<ArrayBuffer> {
        // If salt is not provided, it is set to a string of HashLen zeros.
        // We handle empty/null salt by creating zero buffer
        const saltBuffer = (salt && salt.byteLength > 0) ? salt : new ArrayBuffer(32);
        const saltKey = await this.importHmacKey(saltBuffer);
        return this.hmacSha256(saltKey, ikm);
    }

    // HKDF Expand: OKM = HMAC-Hash(PRK, info | 0x01)
    async hkdfExpand(prk: BufferSource, info: BufferSource, length: number): Promise<ArrayBuffer> {
        const prkKey = await this.importHmacKey(prk);
        let okm = new Uint8Array(0);
        let t = new Uint8Array(0);
        let i = 1;

        while (okm.length < length) {
            const infoArray = new Uint8Array(info as any);
            const counter = new Uint8Array([i]);

            // T(i) = HMAC-Hash(PRK, T(i-1) | info | i)
            const dataToSign = new Uint8Array(t.length + infoArray.length + 1);
            dataToSign.set(t);
            dataToSign.set(infoArray, t.length);
            dataToSign.set(counter, t.length + infoArray.length);

            const signature = await this.hmacSha256(prkKey, dataToSign);
            t = new Uint8Array(signature);

            const newOkm = new Uint8Array(okm.length + t.length);
            newOkm.set(okm);
            newOkm.set(t, okm.length);
            okm = newOkm;
            i++;
        }

        return okm.slice(0, length).buffer;
    }

    // KDF for Ratchet (Chain Key -> [New Chain Key, Message Key])
    // Returns { nextChainKey, messageKey } as CryptoKeys (AES-GCM 256)
    async kdfChain(chainKeyRaw: BufferSource): Promise<{ nextChainKey: ArrayBuffer, messageKey: CryptoKey }> {
        // Input: Chain Key (32 bytes)
        // Constants used: Zero Salt for Extract, string info for Expand
        const salt = new ArrayBuffer(32);
        const prk = await this.hkdfExtract(salt, chainKeyRaw);

        // Derive Message Key (Offset 0x01) and Next Chain Key (Offset 0x02) via Info
        // Expand 64 bytes: First 32 for Msg Key, Next 32 for Next Chain
        const info = new TextEncoder().encode("Ratchet");
        const materials = await this.hkdfExpand(prk, info, 64);

        const msgKeyRaw = materials.slice(0, 32);
        const nextChainKeyRaw = materials.slice(32, 64);

        // Import Message Key for use
        const messageKey = await window.crypto.subtle.importKey(
            "raw",
            msgKeyRaw,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
        );

        return { nextChainKey: nextChainKeyRaw, messageKey };
    }

    // --- Ratchet State Management --- //

    /*
      RatchetState Interface (Stored in LocalStorage JSON):
      {
        rootKey: string (Base64),       // Shared Secret (Master)
        chainKeySend: string (Base64),  // Current Sending Chain
        chainKeyRecv: string (Base64),  // Current Receiving Chain
      }
    */

    getSessionKey(contactId: string): string {
        return `ratchet_session_${contactId}`;
    }

    saveSession(contactId: string, state: any) {
        localStorage.setItem(this.getSessionKey(contactId), JSON.stringify(state));
    }

    loadSession(contactId: string): any {
        const raw = localStorage.getItem(this.getSessionKey(contactId));
        return raw ? JSON.parse(raw) : null;
    }

    clearSession(contactId: string) {
        localStorage.removeItem(this.getSessionKey(contactId));
    }

    // --- High-Level Ratchet Operations --- //

    async encryptWithRatchet(plainText: string, recipientId: string, recipientPubKeyStr: string): Promise<string> {
        try {
            let session = this.loadSession(recipientId);
            let bootstrapHeader = null;

            // 1. Bootstrap if needed (X3DH-Lite)
            if (!session) {
                // Generate Root Key (Shared Secret) - 32 bytes
                const rootKey = window.crypto.getRandomValues(new Uint8Array(32));

                // Initialize Chains (Root -> Send/Recv)
                // For MVP: We derive semantic keys from Root
                const rootPrk = await this.hkdfExtract(new ArrayBuffer(32), rootKey);
                // Expand to 64 bytes: 32 for SendChain, 32 for RecvChain (Initial)
                // NOTE: Real Double Ratchet is more complex (DH). This is Symmetric Ratchet.
                const chains = await this.hkdfExpand(rootPrk, new TextEncoder().encode("InitChains"), 64);

                session = {
                    rootKey: this.arrayBufferToBase64(rootKey.buffer),
                    chainKeySend: this.arrayBufferToBase64(chains.slice(0, 32)),
                    chainKeyRecv: this.arrayBufferToBase64(chains.slice(32, 64))
                    // Note: Recv/Send logic depends on who started. 
                    // Simplified: Initiator sets BOTH. 
                    // *CRITICAL*: Sender's SendChain = Receiver's RecvChain.
                    // To sync, we must send the RootKey securely.
                };

                // Encrypt RootKey for Recipient (RSA) -> Header
                const recipientPubKey = await this.importKey(recipientPubKeyStr, 'public');
                const encryptedRoot = await window.crypto.subtle.encrypt(
                    { name: "RSA-OAEP" },
                    recipientPubKey,
                    rootKey
                );
                bootstrapHeader = this.arrayBufferToBase64(encryptedRoot);
            }

            // 2. Ratchet Forward (Sender)
            const currentChain = this.base64ToArrayBuffer(session.chainKeySend);
            const { nextChainKey, messageKey } = await this.kdfChain(currentChain);

            // Update Session
            session.chainKeySend = this.arrayBufferToBase64(nextChainKey);
            this.saveSession(recipientId, session);

            // 3. Encrypt Message
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(plainText);
            const cipher = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                messageKey,
                encoded
            );

            // 4. Package
            const pkg: any = {
                d: this.arrayBufferToBase64(cipher),
                i: this.arrayBufferToBase64(iv.buffer),
                v: 2 // Version 2 = Ratchet
            };
            if (bootstrapHeader) {
                pkg.h = bootstrapHeader; // Attach Bootstrap Header
            }

            return JSON.stringify(pkg);

        } catch (e) {
            this.logger.error("Ratchet Encrypt Failed", e);
            return "";
        }
    }

    async decryptWithRatchet(packageStr: string, senderId: string, myPrivateKeyStr: string): Promise<string> {
        try {
            const pkg = JSON.parse(packageStr);

            // Check Protocol Version
            if (!pkg.v || pkg.v !== 2) {
                // Fallback to Legacy (Hybrid RSA+AES) for backward compatibility
                return this.decryptMessage(packageStr, myPrivateKeyStr);
            }

            let session = this.loadSession(senderId);

            // 1. Handle Bootstrap Header
            if (pkg.h) {
                // New Session Initiation
                const myPrivKey = await this.importKey(myPrivateKeyStr, 'private');
                const rootKeyRaw = await window.crypto.subtle.decrypt(
                    { name: "RSA-OAEP" },
                    myPrivKey,
                    this.base64ToArrayBuffer(pkg.h)
                );

                // Derive Initial Chains (Must match Sender's derivation)
                const rootPrk = await this.hkdfExtract(new ArrayBuffer(32), rootKeyRaw);
                const chains = await this.hkdfExpand(rootPrk, new TextEncoder().encode("InitChains"), 64);

                session = {
                    rootKey: this.arrayBufferToBase64(rootKeyRaw),
                    // *CRITICAL*: Sender's SendChain = My RecvChain.
                    // Sender's RecvChain = My SendChain.
                    // The Sender (Initiator) used 0-32 for Send. So I use 0-32 for Recv.
                    chainKeyRecv: this.arrayBufferToBase64(chains.slice(0, 32)),
                    chainKeySend: this.arrayBufferToBase64(chains.slice(32, 64))
                };

                // Overwrite/Save Session
                this.saveSession(senderId, session);
            }

            if (!session) return "🔒 Error: No Session";

            // 2. Ratchet Forward (Receiver)
            // Note: In real Double Ratchet, we handle out-of-order via "Skipped Message Keys".
            // MVP: Strict Ordering / Linear Ratchet. If a message is lost, descryption fails (Gap).
            // We assume mostly ordered delivery via Firestore for now.

            const currentChain = this.base64ToArrayBuffer(session.chainKeyRecv);
            const { nextChainKey, messageKey } = await this.kdfChain(currentChain);

            // 3. Decrypt
            const iv = this.base64ToArrayBuffer(pkg.i);
            const cipher = this.base64ToArrayBuffer(pkg.d);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(iv) },
                messageKey,
                cipher
            );

            // Only commit key update if decryption checks out
            session.chainKeyRecv = this.arrayBufferToBase64(nextChainKey);
            this.saveSession(senderId, session);

            return new TextDecoder().decode(decrypted);

        } catch (e) {
            this.logger.error("Ratchet Decrypt Failed", e);
            return "🔒 Decryption Failed (Ratchet)";
        }
    }
}
