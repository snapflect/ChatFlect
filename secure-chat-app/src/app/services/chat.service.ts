import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, getDoc, doc, setDoc, updateDoc, where, increment, arrayUnion } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { Observable, BehaviorSubject } from 'rxjs';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { ToastController } from '@ionic/angular';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    private db: any;
    private messagesSubject = new BehaviorSubject<any[]>([]);

    constructor(
        private crypto: CryptoService,
        private api: ApiService,
        private toast: ToastController,
        private logger: LoggingService,
        private auth: AuthService
    ) {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);
    }

    // Get and Decrypt messages
    getMessages(chatId: string): Observable<any[]> {
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const combined$ = new Observable<any[]>(observer => {
            // Subscribe to both Messages and Blocked lists
            const unsubMsg = onSnapshot(q, (snapshot) => {
                const blocked = this.auth.getBlockedListSnapshot(); // Helper or subscribe? 
                // Better: rely on current value if behavior subject
                // Wait, I can't easily sync snapshot and observable here without RxJS combineLatest.
                // Simplified: Re-emit whenever messages change, filtering against *current* blocked list.

                // We need to subscribe to blockedUsers inside here OR use combineLatest outside.
                // Let's use combineLatest pattern in getMessages return or simpler:
                // Just peek current blocked value if possible, or simple subscription
            });
        });

        // Revised approach:
        return new Observable(observer => {
            let messages: any[] = [];
            let blocked: string[] = [];

            const update = () => {
                const filtered = messages.filter(m => !blocked.includes(m.senderId));
                observer.next(filtered);
            };

            const unsubAuth = this.auth.blockedUsers$.subscribe(b => {
                blocked = b;
                update();
            });

            const unsubMsg = onSnapshot(q, async (snapshot) => {
                const msgsRaw = [];
                const privateKeyStr = localStorage.getItem('private_key');
                const myId = String(localStorage.getItem('user_id')).trim();

                for (const d of snapshot.docs) {
                    const data = d.data();
                    if (data['deletedFor'] && data['deletedFor'].includes(myId)) continue;

                    // Expiration Check
                    if (data['expiresAt'] && Date.now() > data['expiresAt']) {
                        continue; // Hidden (Distributed GC: Sender could delete here, but hiding is enough for MVP)
                    }

                    // Decrypt Logic (Inline for scope access) - Reusing existing logic
                    let decrypted = "Wait...";
                    if (data['isDeleted']) {
                        decrypted = "🚫 This message was deleted";
                    } else if (privateKeyStr) {
                        // ... (Exact same decryption logic as before) ...
                        const senderId = String(data['senderId']).trim();
                        const isMe = senderId === myId;
                        let cipherText = '';
                        if (isMe) {
                            cipherText = data['content_self'] || (typeof data['content'] === 'string' ? data['content'] : data['content'][myId]);
                        } else {
                            if (typeof data['content'] === 'string') {
                                cipherText = data['content'];
                            } else if (data['content'] && data['content'][myId]) {
                                cipherText = data['content'][myId];
                            }
                        }

                        if (cipherText) {
                            try {
                                const plain = await this.crypto.decryptMessage(cipherText, privateKeyStr);
                                if (!plain.includes("[Decryption Error]") && plain !== '') {
                                    decrypted = plain;
                                    try {
                                        const metadata = JSON.parse(decrypted);
                                        if (metadata && metadata.type === 'image') decrypted = metadata;
                                    } catch (e) { }
                                } else {
                                    decrypted = "🔒 Decryption Failed";
                                }
                            } catch (e) { decrypted = "🔒 Error"; }
                        } else { decrypted = "🔒 Encrypted (Not for you)"; }
                    }
                    msgsRaw.push({ id: d.id, ...data, text: decrypted });
                }
                messages = msgsRaw;
                update();
            });

            return () => {
                unsubAuth.unsubscribe();
                unsubMsg();
            };
        });
    }

    getChatDetails(chatId: string) {
        return new Observable(observer => {
            onSnapshot(doc(this.db, 'chats', chatId), (doc) => {
                observer.next(doc.exists() ? { id: doc.id, ...doc.data() } : null);
            });
        });
    }

    // Create Group (MySQL + Firestore)
    async createGroup(name: string, userIds: string[]) {
        const myId = String(localStorage.getItem('user_id'));
        // 1. Create in MySQL (Master)
        const res: any = await this.api.post('groups.php', {
            action: 'create',
            name: name,
            created_by: myId,
            members: userIds
        }).toPromise();

        if (res && res.status === 'success') {
            const groupId = res.group_id;

            // 2. Create in Firestore
            const chatRef = doc(this.db, 'chats', groupId);
            await setDoc(chatRef, {
                participants: [...userIds, myId], // Ensure all members + creator
                isGroup: true,
                groupName: name,
                groupOwner: myId,
                createdAt: Date.now(),
                lastMessage: 'Group Created',
                lastTimestamp: Date.now()
            });
            return groupId;
        } else {
            throw new Error(res.error || 'Failed to create group');
        }
    }

    async sendMessage(chatId: string, plainText: string, senderId: string, replyTo: any = null) {
        try {
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            if (!chatDoc.exists()) return;

            const chatData = chatDoc.data();
            const participants = chatData['participants'] || [];
            const isGroup = !!chatData['isGroup'];
            const contentMap: any = {};

            // My Key
            const myPubKey = localStorage.getItem('public_key');
            let encryptedSelf = '';
            if (myPubKey) {
                encryptedSelf = await this.crypto.encryptMessage(plainText, myPubKey);
                contentMap[senderId] = encryptedSelf;
            }

            // Recipients
            for (const p of participants) {
                const pid = String(p).trim();
                if (pid === String(senderId).trim()) continue;

                try {
                    const res: any = await this.api.get(`keys.php?user_id=${pid}`).toPromise();
                    if (res && res.public_key) {
                        const cypher = await this.crypto.encryptMessage(plainText, res.public_key);
                        contentMap[pid] = cypher;
                    }
                } catch (e) {
                    this.logger.error(`Failed to fetch key for ${pid}`, e);
                }
            }

            // Payload
            const ttl = await this.getChatTTL(chatId);
            const payload: any = {
                senderId,
                timestamp: Date.now(),
                content_self: encryptedSelf,
                expiresAt: ttl > 0 ? Date.now() + ttl : null
            };

            // Add Reply Data (Keep Unencrypted for easy UI render, or encrypt if high security needed. 
            // For MVP, we store a snippet unencrypted for context, or rely on client to fetch original msg by ID)
            // Let's store snippet for performance.
            if (replyTo) {
                payload['replyTo'] = {
                    id: replyTo.id,
                    // text: replyTo.text, // REMOVED DUPLICATE
                    senderId: replyTo.senderId,
                    text: typeof replyTo.text === 'string' ? replyTo.text.substring(0, 50) : '[Media]'
                };
            }

            if (isGroup) {
                payload['content'] = contentMap;
            } else {
                const other = Object.keys(contentMap).find(k => k !== senderId);
                payload['content'] = (other && contentMap[other]) ? contentMap[other] : contentMap;
            }

            await addDoc(collection(this.db, 'chats', chatId, 'messages'), payload);

            // Update Parent
            const updatePayload: any = {
                lastMessage: isGroup ? `${plainText.substring(0, 20)}...` : 'Encrypted Message',
                lastTimestamp: Date.now()
            };

            participants.forEach((p: any) => {
                if (String(p) !== String(senderId)) {
                    updatePayload[`unread_${p}`] = increment(1);
                }
            });

            await updateDoc(doc(this.db, 'chats', chatId), updatePayload);
            this.sendPushNotification(chatId, senderId, "🔒 Encrypted Message");

            await updateDoc(doc(this.db, 'chats', chatId), updatePayload);
            this.sendPushNotification(chatId, senderId, "🔒 Encrypted Message");

        } catch (e) {
            this.logger.error("Send Error", e);
        }
    }

    // Update Auto-Delete Timer (0 = Off, otherwise ms)
    async setChatTimer(chatId: string, durationMs: number) {
        await updateDoc(doc(this.db, 'chats', chatId), {
            autoDeleteTimer: durationMs
        });
    }

    // Helper: Check for expiration during send
    private async getChatTTL(chatId: string): Promise<number> {
        const d = await getDoc(doc(this.db, 'chats', chatId));
        return d.exists() ? (d.data()['autoDeleteTimer'] || 0) : 0;
    }

    async sendImageMessage(chatId: string, imageBlob: Blob, senderId: string, caption: string = '') {
        try {
            // 1. Upload Encryption (AES)
            const { encryptedBlob: blobEnc, key: aesKey, iv } = await this.crypto.encryptBlob(imageBlob);
            const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);

            // Upload Encrypted Blob
            const formData = new FormData();
            formData.append('file', blobEnc, 'secure_img.bin');

            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes || !uploadRes.url) throw new Error("Upload Failed");

            // 2. Prepare Metadata
            const metadata = {
                type: 'image',
                url: uploadRes.url,
                i: this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer),
                caption: caption
            };

            await this.handleMediaFanout(chatId, senderId, metadata, aesKeyRaw, '📷 Photo');

        } catch (e) {
            this.logger.error("Image Send Failed", e);
        }
    }

    async sendAudioMessage(chatId: string, audioBlob: Blob, senderId: string, duration: number) {
        try {
            const { encryptedBlob: blobEnc, key: aesKey, iv } = await this.crypto.encryptBlob(audioBlob);
            const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);

            const formData = new FormData();
            formData.append('file', blobEnc, 'voice.bin');

            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes || !uploadRes.url) throw new Error("Audio Upload Failed");

            const metadata = {
                type: 'audio',
                url: uploadRes.url,
                i: this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer),
                d: duration
            };

            await this.handleMediaFanout(chatId, senderId, metadata, aesKeyRaw, '🎤 Voice Note');

        } catch (e) {
            this.logger.error("Audio Send Failed", e);
        }
    }

    async sendDocumentMessage(chatId: string, file: File, senderId: string) {
        try {
            const { encryptedBlob: blobEnc, key: aesKey, iv } = await this.crypto.encryptBlob(file);
            const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);

            const formData = new FormData();
            formData.append('file', blobEnc, 'doc.bin');

            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes || !uploadRes.url) throw new Error("Doc Upload Failed");

            const metadata = {
                type: 'document',
                url: uploadRes.url,
                i: this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer),
                name: file.name,
                size: file.size,
                mime: file.type
            };

            await this.handleMediaFanout(chatId, senderId, metadata, aesKeyRaw, '📄 Document');

        } catch (e) {
            this.logger.error("Doc Send Failed", e);
        }
    }

    async sendLocationMessage(chatId: string, lat: number, lng: number, senderId: string) {
        try {
            const dummyKey = await this.crypto.generateSessionKey();
            const dummyKeyRaw = await window.crypto.subtle.exportKey("raw", dummyKey);

            const metadata = {
                type: 'location',
                lat: lat,
                lng: lng
            };

            await this.handleMediaFanout(chatId, senderId, metadata, dummyKeyRaw, '📍 Location');

        } catch (e) {
            this.logger.error("Location Send Failed", e);
        }
    }

    // Trigger Push Notification
    private async sendPushNotification(chatId: string, senderId: string, messageText: string, excludeSender: boolean = true) {
        // 1. Get Participants
        const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
        if (!chatDoc.exists()) return;

        const data = chatDoc.data();
        const participants = data['participants'] || [];
        const isGroup = data['isGroup'];
        const chatName = data['name'] || 'New Message'; // Use group name or generic

        // 2. Loop and Send
        for (const p of participants) {
            const pid = String(p).trim();
            if (excludeSender && pid === String(senderId).trim()) continue;

            // TODO: Get Sender Name? For now use generic or chat name
            const title = isGroup ? chatName : 'New Secure Message';

            this.api.post('push.php', {
                target_user_id: pid,
                title: title,
                body: messageText // Note: This might be encrypted content or just "New Audio/Image"
            }).subscribe();
        }
    }

    getChats(userId: string) {
        return this.getMyChats();
    }

    // Helper to reduce duplication
    public async handleMediaFanout(chatId: string, senderId: string, metadata: any, aesKeyRaw: ArrayBuffer, lastMsgText: string) {
        // 3. Encrypt Metadata (Fan-out)
        const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
        const participants = chatDoc.exists() ? chatDoc.data()['participants'] : [];
        const isGroup = chatDoc.exists() ? chatDoc.data()['isGroup'] : false;

        const contentMap: any = {};
        const myPubKey = localStorage.getItem('public_key');
        let encryptedSelf = '';

        if (myPubKey) {
            const encKey = await this.crypto.encryptMessage(this.crypto.arrayBufferToBase64(aesKeyRaw), myPubKey);
            const myMeta = { ...metadata, k: encKey };
            encryptedSelf = await this.crypto.encryptMessage(JSON.stringify(myMeta), myPubKey);
            contentMap[senderId] = encryptedSelf;
        }

        for (const p of participants) {
            const pid = String(p).trim();
            if (pid === String(senderId).trim()) continue;

            const res: any = await this.api.get(`keys.php?user_id=${pid}`).toPromise();
            if (res && res.public_key) {
                const encKey = await this.crypto.encryptMessage(this.crypto.arrayBufferToBase64(aesKeyRaw), res.public_key);
                const userMeta = { ...metadata, k: encKey };
                const cypher = await this.crypto.encryptMessage(JSON.stringify(userMeta), res.public_key);
                contentMap[pid] = cypher;
            }
        }

        // 4. Save
        const payload: any = {
            senderId,
            timestamp: Date.now(),
            content_self: encryptedSelf
        };

        if (isGroup) {
            payload['content'] = contentMap;
        } else {
            const other = Object.keys(contentMap).find(k => k !== senderId);
            payload['content'] = contentMap[other!] || contentMap;
        }

        await addDoc(collection(this.db, 'chats', chatId, 'messages'), payload);

        await updateDoc(doc(this.db, 'chats', chatId), {
            lastMessage: lastMsgText,
            lastTimestamp: Date.now()
        });

        // After fanout, trigger push
        this.sendPushNotification(chatId, senderId, lastMsgText);
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
    async deleteMessage(chatId: string, messageId: string, forEveryone: boolean) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = doc(this.db, 'chats', chatId, 'messages', messageId);

        if (forEveryone) {
            // Delete content globally
            await updateDoc(msgRef, {
                isDeleted: true,
                content: '',
                content_self: '',
                deletedBy: myId
            });
            // Optional: Trigger push to update UI? Not strictly needed for silent update.
        } else {
            // Delete for Me Only
            await updateDoc(msgRef, {
                deletedFor: arrayUnion(myId)
            });
        }
    }

    async addReaction(chatId: string, messageId: string, reaction: string) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = doc(this.db, 'chats', chatId, 'messages', messageId);

        await updateDoc(msgRef, {
            [`reactions.${myId}`]: reaction
        });
    }

    async removeReaction(chatId: string, messageId: string) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = doc(this.db, 'chats', chatId, 'messages', messageId);

        // Note: Ideally use deleteField() from firestore. 
        // For now, setting to null works if UI handles it.
        await updateDoc(msgRef, {
            [`reactions.${myId}`]: null
        });
    }
}
