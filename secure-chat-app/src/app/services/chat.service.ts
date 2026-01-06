import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, getDoc, doc, setDoc, updateDoc, where, increment } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { Observable, BehaviorSubject } from 'rxjs';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { ToastController } from '@ionic/angular';

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    private db: any;
    private messagesSubject = new BehaviorSubject<any[]>([]);

    constructor(
        private crypto: CryptoService,
        private api: ApiService,
        private toast: ToastController
    ) {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);
    }

    // Get and Decrypt messages
    getMessages(chatId: string): Observable<any[]> {
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        onSnapshot(q, async (snapshot) => {
            const messages = [];
            const privateKeyStr = localStorage.getItem('private_key'); // My Private Key

            for (const d of snapshot.docs) {
                const data = d.data();
                let decrypted = "Wait...";

                if (privateKeyStr) {
                    // Check if I am the sender
                    const myId = String(localStorage.getItem('user_id')).trim();
                    const senderId = String(data['senderId']).trim();
                    const isMe = senderId === myId;

                    const cipherText = isMe ? (data['content_self'] || data['content']) : data['content'];

                    if (cipherText) {
                        try {
                            const plain = await this.crypto.decryptMessage(cipherText, privateKeyStr);
                            if (!plain.includes("[Decryption Error]")) {
                                decrypted = plain;
                                // Check Metadata
                                try {
                                    const metadata = JSON.parse(decrypted);
                                    if (metadata && metadata.type === 'image') decrypted = metadata;
                                } catch (e) { }
                            } else {
                                decrypted = "🔒 Decryption Failed";
                            }
                        } catch (e) {
                            decrypted = "🔒 Error";
                        }
                    } else {
                        decrypted = "🔒 Encrypted";
                    }
                }

                // Handle "My" messages (already decrypted or raw) 
                // Note: Sender usually stores local copy. Here we re-decrypt our own msg which works if we encrypt session key for ourselves too?
                // Wait, current design only encrypts session key for Recipient.
                // So Sender CANNOT decrypt their own sent messages if they reload!
                // Fix for Phase 2: Encrypt session key for Sender too.
                // For now, let's ignore that and focus on Receiver.

                messages.push({ id: d.id, ...data, text: decrypted });
            }
            this.messagesSubject.next(messages);
        });

        return this.messagesSubject.asObservable();
    }

    // Send a message (Encrypted)
    async sendMessage(chatId: string, plainText: string, senderId: string) {
        try {
            // 1. Get Chat Metadata to find Recipient
            // Assuming chat doc has 'participants' array [id1, id2]
            // In real app optimize this (cache, or pass recipient ID)
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            if (!chatDoc.exists()) return;

            const participants = chatDoc.data()['participants'] || [];
            const recipientId = participants.find((p: any) => p != senderId); // Simple 1v1 logic

            if (!recipientId) return;

            // 2. Get Recipient Public Key from API
            console.log(`Getting key for recipient: ${recipientId}`);
            const res: any = await this.api.get(`keys.php?user_id=${recipientId}`).toPromise();
            if (!res || !res.public_key) {
                console.error("Recipient Key not found for ID:", recipientId);
                const t = await this.toast.create({
                    message: 'Security Error: Recipient Public Key not found. Cannot send encrypted message.',
                    duration: 3000,
                    color: 'danger'
                });
                t.present();
                return;
            }
            const recipientPubKeyStr = res.public_key;
            console.log("Recipient Key Found. Encrypting...");

            // 3. Encrypt for Recipient
            const encryptedContent = await this.crypto.encryptMessage(plainText, recipientPubKeyStr);
            console.log("Encrypted for recipient");

            // 4. Encrypt for Self (so we can read our own history)
            const myPubKey = localStorage.getItem('public_key');
            let encryptedContentSelf = '';
            if (myPubKey) {
                encryptedContentSelf = await this.crypto.encryptMessage(plainText, myPubKey);
            }

            // 5. Send
            const messagesRef = collection(this.db, 'chats', chatId, 'messages');
            await addDoc(messagesRef, {
                senderId,
                content: encryptedContent,
                content_self: encryptedContentSelf,
                timestamp: Date.now()
            });

            // 6. Update Parent Chat Doc (Last Msg, Timestamp, Unread)
            const chatRef = doc(this.db, 'chats', chatId);
            await updateDoc(chatRef, {
                lastMessage: 'Encrypted Message', // Placeholder for now
                lastTimestamp: Date.now(),
                [`unread_${recipientId}`]: increment(1)
            });

            console.log("Message sent to Firestore!");
        } catch (e) {
            console.error("Send Error", e);
        }
    }

    async sendImageMessage(chatId: string, imageBlob: Blob, senderId: string) {
        try {
            // 1. Encrypt Image Blob
            const { encryptedBlob, key, iv } = await this.crypto.encryptBlob(imageBlob);

            // 2. Upload Encrypted Blob
            const formData = new FormData();
            formData.append('file', encryptedBlob, 'secure_img.bin');

            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes || !uploadRes.url) {
                console.error("Upload failed");
                return;
            }

            // 3. Get Recipient Key
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            if (!chatDoc.exists()) return;
            const participants = chatDoc.data()['participants'] || [];
            const recipientId = participants.find((p: any) => p != senderId);

            if (!recipientId) return;

            const res: any = await this.api.get(`keys.php?user_id=${recipientId}`).toPromise();
            if (!res || !res.public_key) return;

            const recipientPubKey = await this.crypto.importKey(res.public_key, 'public');
            const encryptedKey = await this.crypto.encryptSessionKey(key, recipientPubKey);

            // Encrypt Session Key for Self too
            const myPubKeyStr = localStorage.getItem('public_key');
            let encryptedKeySelf = '';
            if (myPubKeyStr) {
                const myPubKey = await this.crypto.importKey(myPubKeyStr, 'public');
                encryptedKeySelf = await this.crypto.encryptSessionKey(key, myPubKey);
            }
            if (!encryptedKeySelf) console.warn("WARNING: encryptedKeySelf is EMPTY! Sender will not be able to view image.");


            // 4. Construct Metadata
            const metadata = JSON.stringify({
                type: 'image',
                url: uploadRes.url,
                k: encryptedKey,
                ks: encryptedKeySelf, // k_self abbreviated
                i: this.crypto.arrayBufferToBase64(iv.buffer as any)
            });

            // 5. Send as Standard Message (Encrypted Layer 2)
            await this.sendMessage(chatId, metadata, senderId);

        } catch (e) {
            console.error("Image Send Error", e);
        }
    }

    async getOrCreateChat(otherUserId: string) {
        // ... (existing logic)
        const currentUserId = localStorage.getItem('user_id');
        if (!currentUserId) throw new Error('Not logged in');
        const uid1 = String(currentUserId);
        const uid2 = String(otherUserId);
        const sortedIds = [uid1, uid2].sort();
        const deterministicId = `${sortedIds[0]}_${sortedIds[1]}`;
        const chatDocRef = doc(this.db, 'chats', deterministicId);
        const chatDoc = await getDoc(chatDocRef);

        if (chatDoc.exists()) {
            return deterministicId;
        } else {
            // Create
            await setDoc(chatDocRef, {
                participants: [uid1, uid2],
                createdAt: Date.now(),
                lastMessage: '',
                lastTimestamp: Date.now()
            });
            return deterministicId;
        }
    }

    getMyChats(): Observable<any[]> {
        const myId = String(localStorage.getItem('user_id'));
        const chatsRef = collection(this.db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', myId));

        return new Observable(observer => {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // Client-side sort by lastTimestamp descending
                chats.sort((a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
                observer.next(chats);
            });
            return () => unsubscribe();
        });
    }

    async markAsRead(chatId: string) {
        const myId = String(localStorage.getItem('user_id'));
        const chatRef = doc(this.db, 'chats', chatId);
        await updateDoc(chatRef, {
            [`unread_${myId}`]: 0
        });
    }
}
