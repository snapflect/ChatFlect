import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, getDoc, doc, setDoc, updateDoc, where, increment, arrayUnion, arrayRemove, collectionGroup, getDocs, deleteDoc } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
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

    // Event emitter for new incoming messages (for sound notifications)
    public newMessage$ = new Subject<{ chatId: string; senderId: string; timestamp: number }>();
    private lastKnownTimestamps: Map<string, number> = new Map();

    constructor(
        private crypto: CryptoService,
        private api: ApiService,
        private toast: ToastController,
        private logger: LoggingService,
        private auth: AuthService
    ) {
        this.initFirestore();
    }

    protected initFirestore() {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);
    }

    // --- Protected Helper Methods for Mocking ---
    protected fsCollection(...pathSegments: string[]) {
        // collection(db, path, ...segments)
        return collection(this.db, pathSegments[0], ...pathSegments.slice(1));
    }
    protected fsDoc(path: string, ...segments: string[]) {
        return doc(this.db, path, ...segments);
    }
    protected fsQuery(ref: any, ...queryConstraints: any[]) {
        return query(ref, ...queryConstraints);
    }
    protected fsOnSnapshot(ref: any, observer: any, onError?: any) {
        return onSnapshot(ref, observer, onError);
    }
    protected async fsGetDoc(ref: any) {
        return await getDoc(ref);
    }
    protected async fsSetDoc(ref: any, data: any, options?: any) {
        return await setDoc(ref, data, options);
    }
    protected async fsUpdateDoc(ref: any, data: any) {
        return await updateDoc(ref, data);
    }
    protected async fsDeleteDoc(ref: any) {
        return await deleteDoc(ref);
    }
    protected async fsAddDoc(ref: any, data: any) {
        return await addDoc(ref, data);
    }
    protected async fsGetDocs(ref: any) {
        return await getDocs(ref);
    }
    protected fsCollectionGroup(collectionId: string) {
        return collectionGroup(this.db, collectionId);
    }

    // Old getMessages removed. New implementation is below.

    getChatDetails(chatId: string) {
        return new Observable(observer => {
            this.fsOnSnapshot(this.fsDoc('chats', chatId), (doc: any) => {
                observer.next(doc.exists() ? { id: doc.id, ...doc.data() } : null);
            });
        });
    }

    getSharedMedia(chatId: string): Observable<any[]> {
        // Reuse getMessages logic or implement specific media query
        // For shared media gallery, we likely want ALL media, not just recent
        // So a query is better than referencing a limited message list
        const messagesRef = this.fsCollection('chats', chatId, 'messages');
        const q = this.fsQuery(messagesRef, orderBy('timestamp', 'desc')); // Get all messages? Beware size.
        // Optimization: In production, adding 'where type in [image, video]' requires composite index

        return new Observable(observer => {
            return this.fsOnSnapshot(q, (snapshot: any) => {
                const msgs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                observer.next(msgs);
            });
        });
    }

    // Create Group (MySQL + Firestore)
    async createGroup(name: string, userIds: string[], iconUrl?: string) {
        const myId = String(localStorage.getItem('user_id'));
        // 1. Create in MySQL (Master)
        const res: any = await this.api.post('groups.php', {
            action: 'create',
            name: name,
            created_by: myId,
            members: userIds,
            icon_url: iconUrl // Pass to backend if supported
        }).toPromise();

        if (res && res.status === 'success') {
            const groupId = res.group_id;

            // 2. Create in Firestore
            const chatRef = doc(this.db, 'chats', groupId);
            await setDoc(chatRef, {
                participants: [...userIds, myId], // Ensure all members + creator
                isGroup: true,
                groupName: name,
                groupIcon: iconUrl || null, // Store icon
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

    // --- Unified Secure Distribution (Replaces handleMediaFanout) ---
    public async distributeSecurePayload(chatId: string, senderId: string, type: string, cipherText: string, ivBase64: string, sessionKey: CryptoKey, metadata: any = {}, replyTo: any = null) {
        try {
            const chatDoc = await this.getChatDoc(chatId);
            const participants = chatDoc.exists() ? (chatDoc.data() as any)['participants'] : [];
            const isGroup = chatDoc.exists() ? (chatDoc.data() as any)['isGroup'] : false;

            // 1. Encrypt Session Key for Each Recipient
            const keysMap: any = {};

            // My Key
            const myPubKey = localStorage.getItem('public_key');
            if (myPubKey) {
                keysMap[senderId] = await this.crypto.encryptAesKeyForRecipient(sessionKey, myPubKey);
            }

            // Other Participants
            for (const p of participants) {
                const pid = String(p).trim();
                if (pid === String(senderId).trim()) continue;

                try {
                    const res: any = await this.api.get(`keys.php?user_id=${pid}&_t=${Date.now()}`).toPromise();
                    if (res && res.public_key) {
                        keysMap[pid] = await this.crypto.encryptAesKeyForRecipient(sessionKey, res.public_key);
                    }
                } catch (e) {
                    this.logger.error(`Failed to fetch key for ${pid}`, e);
                }
            }

            // 2. Construct Unified Payload
            const ttl = await this.getChatTTL(chatId);
            const payload: any = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: type,
                ciphertext: cipherText, // Encrypted Text or Caption
                iv: ivBase64,           // IV for Content (Text) OR Media File
                keys: keysMap,
                senderId: senderId,
                timestamp: Date.now(),
                expiresAt: ttl > 0 ? Date.now() + ttl : null,
                ...metadata // Spread additional metadata (url, mime, etc.)
            };

            if (replyTo) {
                payload['replyTo'] = {
                    id: replyTo.id,
                    senderId: replyTo.senderId
                };
            }

            // 3. Store
            await this.addMessageDoc(chatId, payload);

            // 4. Update Parent
            const snippet = type === 'text' ? '🔒 Message' : (type === 'image' ? '📷 Photo' : '🔒 Media');
            const updatePayload: any = {
                lastMessage: isGroup ? snippet : 'Encrypted Message',
                lastTimestamp: Date.now()
            };

            participants.forEach((p: any) => {
                if (String(p) !== String(senderId)) {
                    updatePayload[`unread_${p}`] = increment(1);
                }
            });

            await this.updateChatDoc(chatId, updatePayload);
            this.sendPushNotification(chatId, senderId, snippet);

        } catch (e) {
            this.logger.error("Distribute Error", e);
        }
    }


    // --- Send Methods (Using Distribute) ---

    async sendMessage(chatId: string, plainText: string, senderId: string, replyTo: any = null) {
        try {
            // 1. Generate Key & IV
            const sessionKey = await this.crypto.generateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            // 2. Encrypt Text
            const cipherText = await this.crypto.encryptPayload(plainText, sessionKey, iv);

            // 3. Distribute
            await this.distributeSecurePayload(chatId, senderId, 'text', cipherText, ivBase64, sessionKey, {}, replyTo);
        } catch (e) {
            this.logger.error("Send Text Failed", e);
        }
    }

    async sendImageMessage(chatId: string, imageBlob: Blob, senderId: string, caption: string = '') {
        try {
            // 1. Encrypt File (Generates Key + IV)
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(imageBlob);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            // 2. Upload
            const formData = new FormData();
            formData.append('file', encryptedBlob, 'secure_img.bin');
            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes?.url) throw new Error("Upload Failed");

            // 3. Metadata
            const metadata = {
                file_url: uploadRes.url,
                mime: 'image/jpeg'
            };

            await this.distributeSecurePayload(chatId, senderId, 'image', '', ivBase64, sessionKey, metadata);

        } catch (e) {
            this.logger.error("Send Image Failed", e);
        }
    }

    async sendVideoMessageClean(chatId: string, videoBlob: Blob, senderId: string, duration: number, thumbnailBlob: Blob | null, caption: string = '') {
        try {
            // 1. Encrypt Video
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(videoBlob);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            // 2. Upload Video
            const formData = new FormData();
            formData.append('file', encryptedBlob, 'secure_vid.bin');
            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes?.url) throw new Error("Video Upload Failed");

            // 3. Thumbnail (Simplification: No thumb encryption for MVP to avoid IV reuse issues)
            let thumbUrl = '';
            if (thumbnailBlob) {
                const formThumb = new FormData();
                formThumb.append('file', thumbnailBlob, 'thumb.jpg');
                const thumbRes: any = await this.api.post('upload.php', formThumb).toPromise();
                if (thumbRes?.url) thumbUrl = thumbRes.url;
            }

            const metadata: any = {
                file_url: uploadRes.url,
                mime: 'video/mp4',
                d: duration,
                thumb: thumbUrl
            };

            await this.distributeSecurePayload(chatId, senderId, 'video', '', ivBase64, sessionKey, metadata);
        } catch (e) {
            this.logger.error("Video Send Failed", e);
        }
    }

    // Alias for compatibility
    async sendVideoMessage(chatId: string, videoBlob: Blob, senderId: string, duration: number, thumbnailBlob: Blob | null, caption: string = '') {
        return this.sendVideoMessageClean(chatId, videoBlob, senderId, duration, thumbnailBlob, caption);
    }

    async sendDocumentMessage(chatId: string, file: File, senderId: string) {
        try {
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(file);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const formData = new FormData();
            formData.append('file', encryptedBlob, 'doc.bin');
            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();

            const metadata = {
                file_url: uploadRes.url,
                mime: file.type || 'application/octet-stream',
                name: file.name,
                size: file.size
            };

            await this.distributeSecurePayload(chatId, senderId, 'document', '', ivBase64, sessionKey, metadata);
        } catch (e) {
            this.logger.error("Doc Send Failed", e);
        }
    }


    // --- Read & Decrypt ---

    getMessages(chatId: string): Observable<any[]> {
        const messagesRef = this.fsCollection('chats', chatId, 'messages');
        const q = this.fsQuery(messagesRef, orderBy('timestamp', 'asc'));

        return new Observable(observer => {
            let messages: any[] = [];

            const unsubMsg = this.fsOnSnapshot(q, async (snapshot: any) => {
                const msgsRaw = [];
                const privateKeyStr = localStorage.getItem('private_key');
                const myId = String(localStorage.getItem('user_id')).trim();

                for (const d of snapshot.docs) {
                    const data = d.data();
                    if (data['deletedFor'] && data['deletedFor'].includes(myId)) continue;

                    const senderId = String(data['senderId']).trim();
                    let decrypted: any = "🔒 Decrypting...";
                    let mediaUrl = data['file_url'] || null;

                    if (data['isDeleted']) {
                        decrypted = "🚫 Message deleted";
                    } else if (data['type'] === 'system_signal') {
                        msgsRaw.push({ id: d.id, ...data });
                        continue;
                    } else if (privateKeyStr) {
                        // --- Decryption Logic ---
                        try {
                            // Check for New Format (keys map)
                            if (data['keys'] && data['keys'][myId]) {
                                // 1. Decrypt AES Key
                                const encKey = data['keys'][myId];
                                const sessionKey = await this.crypto.decryptAesKeyFromSender(encKey, privateKeyStr);

                                // 2. Decrypt Content (Text or Media)
                                if (data['type'] === 'text') {
                                    decrypted = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                                } else {
                                    // Media: We have the Session Key. We can decrypt the BLOB later.
                                    // The 'ciphertext' field is empty caption.
                                    // We pass the RAW KEY (exported) to the UI? 
                                    // Or the UI calls a service method to decrypt the blob?
                                    // For now, allow viewing.
                                    const rawKey = await window.crypto.subtle.exportKey("raw", sessionKey);
                                    // Construct Media Object for UI (using msg.text which maps to this)
                                    decrypted = {
                                        type: data['type'],
                                        url: data['file_url'],
                                        k: rawKey,
                                        i: data['iv'],
                                        caption: data['caption'] || '',
                                        mime: data['mime'] || '',
                                        d: data['d'] || 0,
                                        thumb: data['thumb'] || ''
                                    };
                                }
                            } else {
                                // Legacy Format Support (content map)
                                const isMe = senderId === myId;
                                let cipherText = '';
                                if (isMe) {
                                    cipherText = data['content_self'];
                                } else if (data['content'] && data['content'][myId]) {
                                    cipherText = data['content'][myId];
                                }

                                if (cipherText) {
                                    // Legacy Hybrid Decrypt
                                    // We can't easily support this if we removed the old crypto method.
                                    // But let's assume old messages are lost or we add back `decryptMessage` alias in CryptoService if needed.
                                    // For now, show "Legacy Message".
                                    decrypted = "🔒 Legacy Message";
                                }
                            }
                        } catch (e) {
                            console.error("Decrypt Fail", e);
                            decrypted = "🔒 Decryption Failed";
                        }
                    }

                    msgsRaw.push({ id: d.id, ...data, text: decrypted });
                }
                observer.next(msgsRaw);
            });
            return () => unsubMsg();
        });
    }

    async sendAudioMessage(chatId: string, audioBlob: Blob, senderId: string, duration: number) {
        try {
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(audioBlob);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const formData = new FormData();
            formData.append('file', encryptedBlob, 'voice.bin');

            const uploadRes: any = await this.api.post('upload.php', formData).toPromise();
            if (!uploadRes || !uploadRes.url) throw new Error("Audio Upload Failed");

            const metadata = {
                type: 'audio',
                url: uploadRes.url,
                d: duration
            };

            await this.distributeSecurePayload(chatId, senderId, 'audio', '', ivBase64, sessionKey, metadata);

        } catch (e) {
            this.logger.error("Audio Send Failed", e);
        }
    }

    // Helper methods for mocking in tests
    protected async getChatDoc(chatId: string) {
        return await this.fsGetDoc(this.fsDoc('chats', chatId));
    }

    protected async addMessageDoc(chatId: string, payload: any) {
        return await this.fsAddDoc(this.fsCollection('chats', chatId, 'messages'), payload);
    }

    protected async updateChatDoc(chatId: string, payload: any) {
        return await this.fsUpdateDoc(this.fsDoc('chats', chatId), payload);
    }

    // Update Auto-Delete Timer (0 = Off, otherwise ms)
    async setChatTimer(chatId: string, durationMs: number) {
        await this.fsUpdateDoc(this.fsDoc('chats', chatId), {
            autoDeleteTimer: durationMs
        });
    }

    // Helper: Check for expiration during send
    private async getChatTTL(chatId: string): Promise<number> {
        const d = await this.fsGetDoc(this.fsDoc('chats', chatId));
        return d.exists() ? ((d.data() as any)['autoDeleteTimer'] || 0) : 0;
    }

    async sendLocationMessage(chatId: string, lat: number, lng: number, senderId: string) {
        try {
            // E2EE Location: Encrypt lat/lng in ciphertext? Or just metadata?
            // Let's encrypt a JSON string of lat/lng in ciphertext
            const sessionKey = await this.crypto.generateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const content = JSON.stringify({ lat, lng });
            const cipherText = await this.crypto.encryptPayload(content, sessionKey, iv);

            await this.distributeSecurePayload(chatId, senderId, 'location', cipherText, ivBase64, sessionKey, {});
        } catch (e) {
            this.logger.error("Location Send Failed", e);
        }
    }

    async sendStickerMessage(chatId: string, url: string, senderId: string) {
        try {
            const sessionKey = await this.crypto.generateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const metadata = { url };
            await this.distributeSecurePayload(chatId, senderId, 'sticker', '', ivBase64, sessionKey, metadata);
        } catch (e) {
            this.logger.error("Sticker Send Failed", e);
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

            const title = isGroup ? chatName : 'New Secure Message';

            this.api.post('push.php', {
                target_user_id: pid,
                title: title,
                body: messageText,
                data: { chatId: chatId } // Deep Linking Support
            }).subscribe();
        }
    }

    getChats(userId: string) {
        return this.getMyChats();
    }

    async getOrCreateChat(otherUserId: string) {
        // ... (existing logic)
        const currentUserId = localStorage.getItem('user_id');
        if (!currentUserId) throw new Error('Not logged in');
        const uid1 = String(currentUserId);
        const uid2 = String(otherUserId);
        const sortedIds = [uid1, uid2].sort();
        const deterministicId = `${sortedIds[0]}_${sortedIds[1]}`;
        const chatDocRef = this.fsDoc('chats', deterministicId);
        const chatDoc = await this.fsGetDoc(chatDocRef);

        if (chatDoc.exists()) {
            return deterministicId;
        } else {
            // Create
            await this.fsSetDoc(chatDocRef, {
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
        const chatsRef = this.fsCollection('chats');
        const q = this.fsQuery(chatsRef, where('participants', 'array-contains', myId));

        return new Observable(observer => {
            const unsubscribe = this.fsOnSnapshot(q, (snapshot: any) => {
                const chats = snapshot.docs
                    .map((d: any) => ({ id: d.id, ...d.data() }))
                    .filter((c: any) => !c[`deleted_${myId}`]); // Filter persistent deletes

                // Client-side sort by lastTimestamp descending
                chats.sort((a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
                observer.next(chats);
            });
            return () => unsubscribe();
        });
    }

    async markAsRead(chatId: string) {
        const myId = String(localStorage.getItem('user_id'));
        const chatRef = this.fsDoc('chats', chatId);
        await this.fsUpdateDoc(chatRef, {
            [`unread_${myId}`]: 0,
            [`last_read_${myId}`]: Date.now()
        });
    }

    async deleteChat(chatId: string): Promise<void> {
        const myId = String(localStorage.getItem('user_id'));
        const chatDocRef = this.fsDoc('chats', chatId);
        await this.fsUpdateDoc(chatDocRef, {
            [`deleted_${myId}`]: true
        });
    }
    async deleteMessage(chatId: string, messageId: string, forEveryone: boolean) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        if (forEveryone) {
            // Delete content globally
            await this.fsUpdateDoc(msgRef, {
                isDeleted: true,
                content: '',
                content_self: '',
                deletedBy: myId
            });
            // Optional: Trigger push to update UI? Not strictly needed for silent update.
        } else {
            // Delete for Me Only
            await this.fsUpdateDoc(msgRef, {
                deletedFor: arrayUnion(myId)
            });
        }
    }

    async addReaction(chatId: string, messageId: string, reaction: string) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        await this.fsUpdateDoc(msgRef, {
            [`reactions.${myId}`]: reaction
        });
    }

    async removeReaction(chatId: string, messageId: string) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        // Note: Ideally use deleteField() from firestore. 
        // For now, setting to null works if UI handles it.
        await this.fsUpdateDoc(msgRef, {
            [`reactions.${myId}`]: null
        });
    }

    async toggleStarMessage(chatId: string, messageId: string, star: boolean) {
        const myId = String(localStorage.getItem('user_id'));
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        await this.fsUpdateDoc(msgRef, {
            starredBy: star ? arrayUnion(myId) : arrayRemove(myId)
        });
    }

    getStarredMessages(): Observable<any[]> {
        const myId = String(localStorage.getItem('user_id'));
        const starredQuery = this.fsQuery(
            this.fsCollectionGroup('messages'),
            where('starredBy', 'array-contains', myId)
        );

        return new Observable(observer => {
            return this.fsOnSnapshot(starredQuery, (snapshot: any) => {
                const msgs = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    chatId: doc.ref.parent.parent?.id,
                    ...(doc.data() as any)
                }));
                observer.next(msgs);
            }, (error: any) => observer.error(error));
        });
    }

    async getUserInfo(userId: string): Promise<{ username: string, photo: string }> {
        if (!userId) return { username: 'Unknown', photo: '' };
        try {
            const userDoc = await this.fsGetDoc(this.fsDoc('users', userId));
            if (userDoc.exists()) {
                const data = userDoc.data() as any;
                // Prefer username (constructed from first/last), then first_name, then fallback
                const name = data['username'] || (data['first_name'] ? `${data['first_name']} ${data['last_name'] || ''}`.trim() : `User ${userId.substr(0, 4)}`);
                return {
                    username: name,
                    photo: data['photo_url'] || data['avatar'] || ''
                };
            }
        } catch (e) {
            this.logger.error("Failed to fetch user info", e);
        }
        return { username: `User ${userId.substr(0, 4)}`, photo: '' };
    }
}
