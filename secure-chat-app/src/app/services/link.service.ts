import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggingService } from './logging.service';
import { CryptoService } from './crypto.service';

@Injectable({
    providedIn: 'root'
})
export class LinkService {
    private db: any;
    private linkSessionSubject = new BehaviorSubject<any>(null);

    constructor(
        private logger: LoggingService,
        private crypto: CryptoService
    ) {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);
    }

    // --- DESKTOP LOGIC ---

    // 1. Generate Link Session (UUID + Ephemeral Key)
    async generateLinkSession(): Promise<{ sessionId: string, publicKey: string, privateKey: string }> {
        const sessionId = self.crypto.randomUUID();
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );

        const pubKeyRaw = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
        const privKeyRaw = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

        const pubKeyStr = this.crypto.arrayBufferToBase64(pubKeyRaw);
        const privKeyStr = this.crypto.arrayBufferToBase64(privKeyRaw);

        return { sessionId, publicKey: pubKeyStr, privateKey: privKeyStr };
    }

    // 2. Listen for Mobile Response
    listenForSync(sessionId: string): Observable<any> {
        const docRef = doc(this.db, 'sync_requests', sessionId);
        return new Observable(observer => {
            const unsub = onSnapshot(docRef, (snap) => {
                if (snap.exists()) {
                    observer.next(snap.data());
                }
            });
            return () => unsub();
        });
    }

    // 3. Decrypt Payload and Save (Session Mirroring)
    async completeHandshake(payloadEncrypted: string, linkPrivateKeyStr: string) {
        try {
            const privKey = await this.crypto.importKey(linkPrivateKeyStr, "private");
            const encryptedBuf = this.crypto.base64ToArrayBuffer(payloadEncrypted);

            const decryptedBuf = await window.crypto.subtle.decrypt(
                { name: "RSA-OAEP" },
                privKey,
                encryptedBuf
            );

            const payloadStr = new TextDecoder().decode(decryptedBuf);
            const data = JSON.parse(payloadStr);

            if (data && data.private_key && data.user_id) {
                // MIRROR SESSION
                localStorage.setItem('private_key', data.private_key);
                localStorage.setItem('public_key', data.public_key);
                localStorage.setItem('user_id', data.user_id);
                if (data.token) localStorage.setItem('auth_token', data.token);
                // Refresh page to load session
                window.location.reload();
            }
        } catch (e) {
            this.logger.error("Handshake Decryption Failed", e);
            throw e;
        }
    }

    // --- MOBILE LOGIC ---

    // 1. Send Keys to Desktop
    async sendSyncData(sessionId: string, desktopPubKeyStr: string) {
        try {
            const myPriv = localStorage.getItem('private_key');
            const myPub = localStorage.getItem('public_key');
            const uid = localStorage.getItem('user_id');
            const token = localStorage.getItem('auth_token');

            if (!myPriv || !uid) throw new Error("No session to share");

            const payload = JSON.stringify({
                private_key: myPriv,
                public_key: myPub,
                user_id: uid,
                token: token
            });

            // Import Desktop's Ephemeral Key
            const desktopPub = await this.crypto.importKey(desktopPubKeyStr, "public");

            // Encrypt Payload
            const encBuf = await window.crypto.subtle.encrypt(
                { name: "RSA-OAEP" },
                desktopPub,
                new TextEncoder().encode(payload)
            );

            const encStr = this.crypto.arrayBufferToBase64(encBuf);

            // Upload to Firestore
            await setDoc(doc(this.db, 'sync_requests', sessionId), {
                payload: encStr,
                timestamp: Date.now()
            });

            this.logger.log("Sync Sent to Desktop");
            return true;

        } catch (e) {
            this.logger.error("Sync Send Failed", e);
            throw e;
        }
    }

    async cleanup(sessionId: string) {
        await deleteDoc(doc(this.db, 'sync_requests', sessionId));
    }
}
