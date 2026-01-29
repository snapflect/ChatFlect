import { Injectable, NgZone } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, getDoc, doc, setDoc, updateDoc, where, increment, arrayUnion, arrayRemove, collectionGroup, getDocs, deleteDoc, limit, startAfter, limitToLast } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { ToastController } from '@ionic/angular';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { PresenceService } from './presence.service';
import { TransferProgressService } from './transfer-progress.service';
import { HttpEventType } from '@angular/common/http';
import { Network } from '@capacitor/network';

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    private db: any;
    private messagesSubject = new BehaviorSubject<any[]>([]);

    // Event emitter for new incoming messages (for sound notifications)
    public newMessage$ = new Subject<{ chatId: string; senderId: string; timestamp: number }>();
    private pendingMessagesSubject = new BehaviorSubject<{ [chatId: string]: any[] }>({});
    public pendingMessages$ = this.pendingMessagesSubject.asObservable();

    private lastKnownTimestamps: Map<string, number> = new Map();
    private publicKeyCache = new Map<string, string>();
    private decryptedCache = new Map<string, any>();

    private isSyncing = false;

    constructor(
        private crypto: CryptoService,
        private api: ApiService,
        private toast: ToastController,
        private logger: LoggingService,
        private auth: AuthService,
        private zone: NgZone,
        private storage: StorageService,
        private presence: PresenceService,
        private progressService: TransferProgressService
    ) {
        this.initFirestore();
        this.initHistorySyncLogic();
        this.presence.initPresenceTracking();
        this.initOfflineSync();
    }

    private async initOfflineSync() {
        Network.addListener('networkStatusChange', status => {
            if (status.connected) {
                console.log('[ChatService][v9] Back online. Flushing outbox...');
                this.flushOutbox();
            }
        });

        // Initial check
        const currentStatus = await Network.getStatus();
        if (currentStatus.connected) {
            this.flushOutbox();
        }
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
            const myId = String(localStorage.getItem('user_id')).trim();

            // My Key
            const myPubKey = localStorage.getItem('public_key');
            if (myPubKey) {
                keysMap[senderId] = await this.crypto.encryptAesKeyForRecipient(sessionKey, myPubKey);
            }

            // Other Participants
            for (const p of participants) {
                const pid = String(p).trim();
                if (pid === String(senderId).trim()) {
                    // Logic to handle multiple devices of sender... (keeping existing logic)
                    try {
                        const res: any = await this.api.get(`keys.php?user_id=${pid}&_t=${Date.now()}`).toPromise();
                        if (res && res.devices) {
                            const myCurrentUuid = localStorage.getItem('device_uuid');
                            for (const [devUuid, devKey] of Object.entries(res.devices)) {
                                if (devUuid !== myCurrentUuid) {
                                    if (!keysMap[pid]) keysMap[pid] = {};
                                    if (typeof keysMap[pid] === 'string') {
                                        const old = keysMap[pid];
                                        keysMap[pid] = { 'primary': old };
                                    }
                                    keysMap[pid][devUuid] = await this.crypto.encryptAesKeyForRecipient(sessionKey, String(devKey));
                                }
                            }
                        }
                    } catch (e) { }
                    continue;
                }

                try {
                    let res: any = null;
                    const cachedKey = await this.storage.getPublicKey(pid);
                    if (cachedKey) {
                        res = { public_key: cachedKey };
                    } else {
                        res = await this.api.get(`keys.php?user_id=${pid}&_t=${Date.now()}`).toPromise();
                        if (res && res.public_key) {
                            this.storage.savePublicKey(pid, res.public_key);
                        }
                    }

                    if (res) {
                        const userKeys: any = {};
                        if (res.public_key) {
                            userKeys['primary'] = await this.crypto.encryptAesKeyForRecipient(sessionKey, res.public_key);
                        }
                        if (res.devices) {
                            for (const [devUuid, devKey] of Object.entries(res.devices)) {
                                userKeys[devUuid] = await this.crypto.encryptAesKeyForRecipient(sessionKey, String(devKey));
                            }
                        }
                        keysMap[pid] = userKeys;
                    }
                } catch (e) { }
            }

            // 2. Construct Unified Payload
            const ttl = await this.getChatTTL(chatId);
            const payload: any = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: type,
                ciphertext: cipherText,
                iv: ivBase64,
                keys: keysMap,
                senderId: senderId,
                timestamp: Date.now(),
                expiresAt: ttl > 0 ? Date.now() + ttl : null,
                ...metadata
            };

            if (replyTo) {
                payload['replyTo'] = { id: replyTo.id, senderId: replyTo.senderId };
            }

            // 3. Persistent Outbox Entry (v9)
            // Save to SQLite Outbox first so it survives restarts
            const outboxId = await this.storage.addToOutbox(chatId, 'send', payload);

            // 4. Attempt Firestore Delivery
            try {
                await this.addMessageDoc(chatId, payload);

                // Update Parent
                const snippet = type === 'text' ? '🔒 Message' : (type === 'image' ? '📷 Photo' : '🔒 Media');
                const updatePayload: any = {
                    lastMessage: isGroup ? snippet : 'Encrypted Message',
                    lastTimestamp: Date.now(),
                    lastSenderId: senderId
                };
                participants.forEach((p: any) => {
                    if (String(p) !== String(senderId)) {
                        updatePayload[`unread_${p}`] = increment(1);
                    }
                });
                await this.updateChatDoc(chatId, updatePayload);
                this.sendPushNotification(chatId, senderId, snippet);

                // Successfully delivered -> Remove from outbox
                await this.storage.removeFromOutbox(outboxId);
            } catch (fireErr) {
                console.warn('[ChatService][v9] Firestore delivery failed. Action cached in outbox.', fireErr);
            }

        } catch (e) {
            this.logger.error("Distribute Error", e);
        }
    }

    /**
     * flushOutbox (v9): Retries all pending offline actions.
     */
    public async flushOutbox() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const pending = await this.storage.getOutbox();
            if (pending.length === 0) return;

            console.log(`[ChatService][v9] Flushing ${pending.length} pending actions...`);

            for (const item of pending) {
                try {
                    if (item.action === 'send') {
                        await this.addMessageDoc(item.chat_id, item.payload);
                    } else if (item.action === 'delete') {
                        // Implement offline delete sync if needed
                    }

                    // Success -> Clean up
                    await this.storage.removeFromOutbox(item.id);
                } catch (err) {
                    console.error(`[ChatService][v9] Failed to flush outbox item ${item.id}`, err);
                    await this.storage.incrementOutboxRetry(item.id);
                    break; // Stop flushing on first failure to preserve order
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }


    private addPending(chatId: string, msg: any) {
        const current = this.pendingMessagesSubject.value;
        const chatPending = current[chatId] || [];
        this.pendingMessagesSubject.next({
            ...current,
            [chatId]: [...chatPending, msg]
        });
    }

    private removePending(chatId: string, msgId: string) {
        const current = this.pendingMessagesSubject.value;
        if (!current[chatId]) return;
        this.pendingMessagesSubject.next({
            ...current,
            [chatId]: current[chatId].filter(m => m.id !== msgId)
        });
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



    // Overload for viewOnce
    async sendImageMessage(chatId: string, imageBlob: Blob, senderId: string, caption: string = '', viewOnce: boolean = false) {
        try {
            // 1. Encrypt Image
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(imageBlob);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            // 2. Upload Encrypted with progress
            const formData = new FormData();
            formData.append('file', encryptedBlob, 'secure_img.bin');

            const tempId = `up_${Date.now()}`;
            this.progressService.updateProgress(tempId, 0, 'uploading');

            // Optimistic Add
            this.addPending(chatId, {
                id: tempId,
                senderId: senderId,
                timestamp: Date.now(),
                type: 'image',
                text: {
                    type: 'image',
                    url: URL.createObjectURL(imageBlob),
                    caption,
                    viewOnce,
                    _isOffline: true,
                    size: imageBlob.size, // Added for signature match
                    tempId: tempId,
                    signature: `image_${imageBlob.size}_${caption || 'nc'}`
                }
            });

            this.api.post('upload.php', formData, true).subscribe(async (event: any) => {
                if (event.type === HttpEventType.UploadProgress) {
                    const percent = Math.round(100 * event.loaded / event.total);
                    this.progressService.updateProgress(tempId, percent, 'uploading');
                } else if (event.type === HttpEventType.Response) {
                    const uploadRes = event.body;
                    if (!uploadRes?.url) {
                        this.progressService.updateProgress(tempId, 0, 'failed');
                        return;
                    }

                    // 3. Metadata
                    const signature = `image_${imageBlob.size}_${caption || 'nc'}`;
                    const metadata: any = {
                        url: uploadRes.url,
                        name: uploadRes.name || (imageBlob as any).name || 'image.jpg',
                        size: uploadRes.size || imageBlob.size || 0,
                        caption: caption,
                        mime: 'image/jpeg',
                        viewOnce: viewOnce,
                        tempId: tempId,
                        signature: signature
                    };

                    await this.distributeSecurePayload(chatId, senderId, 'image', '', ivBase64, sessionKey, metadata);
                    this.progressService.updateProgress(tempId, 100, 'completed');
                    this.removePending(chatId, tempId);
                    setTimeout(() => this.progressService.clearProgress(tempId), 2000);
                }
            }, err => {
                this.progressService.updateProgress(tempId, 0, 'failed');
            });

        } catch (e) {
            this.logger.error("Send Image Failed", e);
        }
    }

    async sendVideoMessageClean(chatId: string, videoBlob: Blob, senderId: string, duration: number, thumbnailBlob: Blob | null, caption: string = '', viewOnce: boolean = false) {
        try {
            // 1. Encrypt Video
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(videoBlob);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            // 2. Upload Video with progress
            const formData = new FormData();
            formData.append('file', encryptedBlob, 'secure_vid.bin');

            const tempId = `up_${Date.now()}`;
            this.progressService.updateProgress(tempId, 0, 'uploading');

            // Optimistic Add
            this.addPending(chatId, {
                id: tempId,
                senderId: senderId,
                timestamp: Date.now(),
                type: 'video',
                text: {
                    type: 'video',
                    url: URL.createObjectURL(videoBlob),
                    d: duration,
                    thumb: thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : '',
                    caption,
                    viewOnce,
                    _isOffline: true,
                    size: videoBlob.size, // Added for signature match
                    tempId: tempId,
                    signature: `video_${videoBlob.size}_${caption || 'nc'}`
                }
            });

            this.api.post('upload.php', formData, true).subscribe(async (event: any) => {
                if (event.type === HttpEventType.UploadProgress) {
                    const percent = Math.round(100 * event.loaded / event.total);
                    this.progressService.updateProgress(tempId, percent, 'uploading');
                } else if (event.type === HttpEventType.Response) {
                    const uploadRes = event.body;
                    if (!uploadRes?.url) {
                        this.progressService.updateProgress(tempId, 0, 'failed');
                        return;
                    }

                    // 3. Thumbnail 
                    let thumbUrl = '';
                    if (thumbnailBlob) {
                        const formThumb = new FormData();
                        formThumb.append('file', thumbnailBlob, 'thumb.jpg');
                        const thumbRes: any = await this.api.post('upload.php', formThumb).toPromise();
                        if (thumbRes?.url) thumbUrl = thumbRes.url;
                    }

                    const metadata: any = {
                        url: uploadRes.url,
                        name: uploadRes.name || (videoBlob as any).name || 'video.mp4',
                        size: uploadRes.size || videoBlob.size || 0,
                        mime: 'video/mp4',
                        d: duration,
                        thumb: thumbUrl,
                        viewOnce: viewOnce,
                        _tempId: tempId,
                        signature: `video_${videoBlob.size}_${caption || 'nc'}`
                    };

                    await this.distributeSecurePayload(chatId, senderId, 'video', '', ivBase64, sessionKey, metadata);
                    this.progressService.updateProgress(tempId, 100, 'completed');
                    this.removePending(chatId, tempId);
                    setTimeout(() => this.progressService.clearProgress(tempId), 2000);
                }
            }, err => this.progressService.updateProgress(tempId, 0, 'failed'));
        } catch (e) {
            this.logger.error("Video Send Failed", e);
        }
    }

    // Alias for compatibility
    async sendVideoMessage(chatId: string, videoBlob: Blob, senderId: string, duration: number, thumbnailBlob: Blob | null, caption: string = '', viewOnce: boolean = false) {
        return this.sendVideoMessageClean(chatId, videoBlob, senderId, duration, thumbnailBlob, caption, viewOnce);
    }

    async sendDocumentMessage(chatId: string, file: File, senderId: string) {
        try {
            const { encryptedBlob, key: sessionKey, iv } = await this.crypto.encryptBlob(file);
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const formData = new FormData();
            formData.append('file', encryptedBlob, 'doc.bin');

            const tempId = `up_${Date.now()}`;
            this.progressService.updateProgress(tempId, 0, 'uploading');

            // Optimistic Add
            this.addPending(chatId, {
                id: tempId,
                senderId: senderId,
                timestamp: Date.now(),
                type: 'document',
                text: {
                    type: 'document',
                    url: URL.createObjectURL(file), // Instantly visible
                    mime: file.type || 'application/octet-stream',
                    name: file.name,
                    size: file.size,
                    _isOffline: true,
                    tempId: tempId
                }
            });

            this.api.post('upload.php', formData, true).subscribe(async (event: any) => {
                if (event.type === HttpEventType.UploadProgress) {
                    const percent = Math.round(100 * event.loaded / event.total);
                    this.progressService.updateProgress(tempId, percent, 'uploading');
                } else if (event.type === HttpEventType.Response) {
                    const uploadRes = event.body;
                    if (!uploadRes?.url) {
                        this.progressService.updateProgress(tempId, 0, 'failed');
                        return;
                    }

                    const metadata = {
                        url: uploadRes.url,
                        mime: file.type || 'application/octet-stream',
                        name: file.name,
                        size: file.size,
                        tempId: tempId,
                        signature: `doc_${file.name}_${file.size}`
                    };

                    await this.distributeSecurePayload(chatId, senderId, 'document', '', ivBase64, sessionKey, metadata);
                    this.progressService.updateProgress(tempId, 100, 'completed');
                    this.removePending(chatId, tempId);
                    setTimeout(() => this.progressService.clearProgress(tempId), 2000);
                }
            }, err => this.progressService.updateProgress(tempId, 0, 'failed'));
        } catch (e) {
            this.logger.error("Doc Send Failed", e);
        }
    }


    // --- Read & Decrypt ---

    // 4. Update getMessages to support limiting (and optionally startAfter but standard listener usually just does LimitToLast)
    // Actually, for "Lazy Loading" on scroll UP, we usually keep the listener for NEW messages, 
    // and use a separate ONE-TIME fetch for older messages.
    // BUT, commonly we want the listener to "expand" or we just fetch older and merge manually.
    // EASIEST PARITY: Listener for "Last 20" + "New".
    // Manual Fetch for "Older than X".

    getMessages(chatId: string, limitCount: number = 20): Observable<any[]> {
        return new Observable(observer => {
            // 1. Try to load from local cache first (Only if limit is small/default)
            if (limitCount <= 20) {
                this.storage.getCachedMessages(chatId).then(cached => {
                    if (cached && cached.length > 0) {
                        console.log(`[ChatService] Loaded ${cached.length} messages from cache for ${chatId}`);
                        this.zone.run(() => observer.next(cached));
                    }
                });
            }

            // 2. Real-time listener (Limit to last N)
            const messagesRef = this.fsCollection('chats', chatId, 'messages');
            // We use 'asc' for logical ordering, but limitToLast gets the *latest* N.
            const q = this.fsQuery(messagesRef, orderBy('timestamp', 'asc'), limitToLast(limitCount));

            const unsubMsg = this.fsOnSnapshot(q, (snapshot: any) => {
                const privateKeyStr = localStorage.getItem('private_key');
                const myId = String(localStorage.getItem('user_id')).trim();

                const promises = snapshot.docs.map(async (d: any) => {
                    const data = d.data();
                    const msgId = d.id;

                    if (data['deletedFor'] && data['deletedFor'].includes(myId)) return null;
                    if (data['expiresAt'] && data['expiresAt'] < Date.now()) return null;

                    const senderId = String(data['senderId']).trim();
                    let decrypted: any = "🔒 Decrypting...";

                    if (data['isDeleted']) {
                        decrypted = { type: 'revoked' };
                    } else if (data['type'] === 'system_signal') {
                        decrypted = { type: 'system' };
                    } else if (data['type'] === 'live_location') {
                        decrypted = {
                            type: 'live_location',
                            lat: data['lat'],
                            lng: data['lng'],
                            expiresAt: data['expiresAt']
                        };
                    } else if (privateKeyStr) {
                        // DEBUG: Log keys to verify "url" presence
                        // if (data['type'] === 'image' || data['type'] === 'video' || data['type'] === 'document') {
                        //    console.log(`[ChatService Debug] ${data['type']} ${msgId}:`, 
                        //      'url:', data['url'], 
                        //      'file_url:', data['file_url'],
                        //      'name:', data['name']
                        //    );
                        // }

                        try {
                            if (data['keys'] && data['keys'][myId]) {
                                let encKey = data['keys'][myId];
                                if (typeof encKey === 'object') {
                                    const devUuid = localStorage.getItem('device_uuid') || 'unknown';
                                    encKey = encKey[devUuid] || encKey['primary'] || Object.values(encKey)[0];
                                }

                                const sessionKey = await this.crypto.decryptAesKeyFromSender(encKey, privateKeyStr);
                                if (data['type'] === 'text') {
                                    decrypted = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                                } else if (data['type'] === 'contact' || data['type'] === 'location') {
                                    const jsonStr = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                                    decrypted = JSON.parse(jsonStr);
                                    decrypted.type = data['type'];
                                } else {
                                    const rawKey = await window.crypto.subtle.exportKey("raw", sessionKey);
                                    decrypted = {
                                        type: data['type'],
                                        url: data['file_url'] || data['url'],
                                        k: (data['k'] || data['ks']) ? (data['k'] || data['ks']) : (this.crypto.arrayBufferToBase64(rawKey)),
                                        i: data['iv'],
                                        caption: data['caption'] || '',
                                        mime: data['mime'] || '',
                                        viewOnce: data['viewOnce'],
                                        tempId: data['tempId'] || data['_tempId'],
                                        name: data['name'],
                                        size: data['size'],
                                        d: data['d'],
                                        thumb: data['thumb']
                                    };
                                }
                            }
                        } catch (e) {
                            decrypted = "🔒 Decryption Failed";
                        }
                    }

                    const finalMsg = { id: msgId, ...data, text: decrypted };

                    // ACTIVE CLEANUP: If we see a tempId from server, kill the local pending copy.
                    if (decrypted && (decrypted.tempId || decrypted._tempId)) {
                        const tId = decrypted.tempId || decrypted._tempId;
                        // Avoid triggering change detection loop if possible, or just fire and forget
                        this.removePending(chatId, tId);
                    }

                    return finalMsg;
                });

                Promise.all(promises).then(msgs => {
                    const validMsgs = msgs.filter(m => m !== null);
                    // 3. Save fully decrypted messages back to cache for next time
                    // Update cache if this is a "latest" fetch
                    if (limitCount <= 50) this.storage.saveMessages(chatId, validMsgs);

                    this.zone.run(() => observer.next(validMsgs));

                    // Check for new messages sound
                    const lastMsg = validMsgs[validMsgs.length - 1];
                    if (lastMsg) {
                        const lastTs = lastMsg.timestamp?.seconds ? lastMsg.timestamp.seconds * 1000 : lastMsg.timestamp;
                        const prevTs = this.lastKnownTimestamps.get(chatId) || 0;
                        if (lastTs > prevTs && lastMsg.senderId !== myId) {
                            this.newMessage$.next({
                                chatId,
                                senderId: lastMsg.senderId,
                                timestamp: lastTs
                            });
                        }
                        this.lastKnownTimestamps.set(chatId, lastTs);
                    }
                });
            });
            return () => unsubMsg();
        });
    }

    async getOlderMessages(chatId: string, lastTimestamp: any, limitCount: number = 20): Promise<any[]> {
        const messagesRef = this.fsCollection('chats', chatId, 'messages');
        // Fetch older: timestamp < lastTimestamp. Order by desc to get "nearest" older ones, then reverse.
        // wait, we want "End Before" or "Start After" logic?
        // Query: Order By Timestamp DESC (newest first). Start After "last known oldest". 
        // Then reverse to ASC.
        // Actually, if we have the "oldest" message currently shown, we want messages with timestamp < oldest.
        // So: orderBy('timestamp', 'desc'), startAfter(oldestTimestamp), limit(limitCount)

        // Ensure timestamp is compatible (Firestore Timestamp vs number)
        // We assume lastTimestamp is the raw firestore value OR number.
        // Best to use the document snapshot if possible, but timestamp field works usually.

        const q = this.fsQuery(messagesRef, orderBy('timestamp', 'desc'), startAfter(lastTimestamp), limit(limitCount));
        const snapshot = await getDocs(q);

        const privateKeyStr = localStorage.getItem('private_key');
        const myId = String(localStorage.getItem('user_id')).trim();

        const promises = snapshot.docs.map(async (d: any) => {
            const data = d.data();
            const msgId = d.id;

            // ... Reuse decryption logic (Refactor into helper ideally, keeping inline for now)
            const senderId = String(data['senderId']).trim();
            let decrypted: any = "🔒 Old Msg"; // Default

            // Fast Decrypt Copy-Paste (Minimal)
            if (data['isDeleted']) {
                decrypted = { type: 'revoked' };
            } else if (data['type'] === 'system_signal') {
                decrypted = { type: 'system' };
            } else if (privateKeyStr) {
                try {
                    if (data['keys'] && data['keys'][myId]) {
                        let encKey = data['keys'][myId];
                        if (typeof encKey === 'object') {
                            const devUuid = localStorage.getItem('device_uuid') || 'unknown';
                            encKey = encKey[devUuid] || encKey['primary'] || Object.values(encKey)[0];
                        }
                        const sessionKey = await this.crypto.decryptAesKeyFromSender(encKey, privateKeyStr);
                        if (data['type'] === 'text') {
                            decrypted = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                        } else if (data['type'] === 'contact') {
                            const jsonStr = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                            decrypted = JSON.parse(jsonStr);
                            decrypted.type = 'contact';
                        } else if (data['type'] === 'live_location') {
                            decrypted = {
                                type: 'live_location',
                                lat: data['lat'],
                                lng: data['lng'],
                                expiresAt: data['expiresAt']
                            };
                        } else {
                            const rawKey = await window.crypto.subtle.exportKey("raw", sessionKey);
                            decrypted = {
                                type: data['type'],
                                url: data['file_url'] || data['url'],
                                k: (data['k'] || data['ks']) ? (data['k'] || data['ks']) : (this.crypto.arrayBufferToBase64(rawKey)),
                                i: data['iv'],
                                caption: data['caption'] || '',
                                mime: data['mime'] || '',
                                thumb: data['thumb'] || '',
                                _tempId: data['_tempId'],
                                name: data['name'],
                                size: data['size'],
                                d: data['d']
                            };
                        }
                    }
                } catch (e) {
                    decrypted = "🔒 Decryption Failed";
                }
            }

            const finalMsg = { id: msgId, ...data, text: decrypted };
            return finalMsg;
        });

        const results = await Promise.all(promises);
        // Reverse to return in ASC order (Oldest -> Newer)
        return results.filter(m => m !== null).reverse();
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
                d: duration,
                mime: audioBlob.type || 'audio/mp4' // Default to mp4/aac if missing
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

    async sendLocationMessage(chatId: string, lat: number, lng: number, senderId: string, label: string = '') {
        try {
            // E2EE Location: Encrypt lat/lng and label in ciphertext
            const sessionKey = await this.crypto.generateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const content = JSON.stringify({ lat, lng, label });
            const cipherText = await this.crypto.encryptPayload(content, sessionKey, iv);

            await this.distributeSecurePayload(chatId, senderId, 'location', cipherText, ivBase64, sessionKey, {});
        } catch (e) {
            this.logger.error("Location Send Failed", e);
        }
    }

    async sendLiveLocationMessage(chatId: string, lat: number, lng: number, senderId: string, durationMinutes: number) {
        try {
            const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
            const chatDoc = await this.getChatDoc(chatId);
            const participants = chatDoc.exists() ? (chatDoc.data() as any)['participants'] : [];

            const payload: any = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: 'live_location',
                lat: lat,
                lng: lng,
                expiresAt: expiresAt,
                senderId: senderId,
                timestamp: Date.now(),
                text: {
                    type: 'live_location',
                    lat: lat,
                    lng: lng,
                    expiresAt: expiresAt
                }
            };

            await this.addMessageDoc(chatId, payload);

            // Update parent chat
            const updatePayload: any = {
                lastMessage: '📍 Live location',
                lastTimestamp: Date.now()
            };
            participants.forEach((p: any) => {
                if (String(p) !== String(senderId)) {
                    updatePayload[`unread_${p}`] = increment(1);
                }
            });
            await this.updateChatDoc(chatId, updatePayload);
            this.sendPushNotification(chatId, senderId, '📍 Live location');
        } catch (e) {
            this.logger.error("Live Location Send Failed", e);
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

    async sendContactMessage(chatId: string, contactData: any, senderId: string) {
        try {
            const sessionKey = await this.crypto.generateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            // Construct Contact Payload
            // We strip unnecessary fields to save size/privacy if needed?
            // Or just send what we have: displayName, phone_number, photo_url
            const payload = {
                name: contactData.displayName || 'Unknown',
                phones: contactData.phone_number ? [contactData.phone_number] : [],
                photo: contactData.photo_url || ''
            };

            const content = JSON.stringify(payload);
            const cipherText = await this.crypto.encryptPayload(content, sessionKey, iv);

            await this.distributeSecurePayload(chatId, senderId, 'contact', cipherText, ivBase64, sessionKey, {});
        } catch (e) {
            this.logger.error("Contact Send Failed", e);
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
            // 1. Load from cache first for instant UI
            this.storage.getCachedChats().then(cached => {
                if (cached && cached.length > 0) {
                    this.zone.run(() => observer.next(cached));
                }
            });

            // 2. Real-time listener
            const unsubscribe = this.fsOnSnapshot(q, (snapshot: any) => {
                const chats = snapshot.docs
                    .map((d: any) => ({ id: d.id, ...d.data() }))
                    .filter((c: any) => !c[`deleted_${myId}`]); // Filter persistent deletes

                // Client-side sort by lastTimestamp descending
                chats.sort((a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

                // 3. Save updated list to cache
                this.storage.saveChats(chats);

                this.zone.run(() => observer.next(chats));
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
            // Delete content globally - mark as revoked
            await this.fsUpdateDoc(msgRef, {
                type: 'revoked',
                content: '',
                content_self: '',
                caption: '',
                deletedBy: myId,
                isDeleted: true,
                // Securely wipe all data fields so it can never be recovered/displayed
                ciphertext: '',
                keys: {},
                iv: '',
                file_url: '',
                url: '',
                thumb: '',
                lat: null,
                lng: null,
                mime: '',
                name: '',
                size: 0,
                contact_name: '',
                contact_number: ''
            });
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

    async setTyping(chatId: string, status: string | boolean) {
        const myId = String(localStorage.getItem('user_id'));
        if (!chatId || !myId) return;

        // Structure: chats/{chatId}/typing/{userId}
        // If status is false => delete doc
        // If status is string/true => set doc with timestamp

        const typeRef = this.fsDoc('chats', chatId, 'typing', myId);

        if (status === false) {
            await this.fsDeleteDoc(typeRef);
        } else {
            await this.fsSetDoc(typeRef, {
                userId: myId,
                isTyping: true,
                timestamp: Date.now()
            });
        }
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
    // --- History Sync ---
    private syncReqUnsub: any;

    initHistorySyncLogic() {
        this.auth.currentUserId.subscribe(uid => {
            if (uid) {
                this.listenForSyncRequests(String(uid));
                this.checkAndRequestHistory(String(uid));
            } else {
                if (this.syncReqUnsub) this.syncReqUnsub();
            }
        });
    }

    private async checkAndRequestHistory(uid: string) {
        const synced = localStorage.getItem('history_synced');
        if (!synced) {
            const deviceUuid = localStorage.getItem('device_uuid');
            // Only request if we have a device UUID (i.e. we are a "Device")
            if (deviceUuid) {
                await this.requestHistorySync(uid);
                localStorage.setItem('history_synced', 'true');
            }
        }
    }

    async requestHistorySync(uid: string) {
        const deviceUuid = localStorage.getItem('device_uuid');
        const publicKey = localStorage.getItem('public_key');
        if (!deviceUuid || !publicKey) return;

        // Check recent requests to avoid spam
        const col = collection(this.db, 'users', uid, 'sync_requests');
        // Add request
        await addDoc(col, {
            requesterUuid: deviceUuid,
            requesterPubK: publicKey,
            timestamp: Date.now()
        });
        this.logger.log("Requested Secret History Sync");
    }

    listenForSyncRequests(uid: string) {
        if (this.syncReqUnsub) this.syncReqUnsub();
        const col = collection(this.db, 'users', uid, 'sync_requests');
        // Offline Support: Increase limit to handle queue
        const q = query(col, orderBy('timestamp', 'asc'), limit(10));

        this.syncReqUnsub = onSnapshot(q, (snapshot: any) => {
            snapshot.docChanges().forEach(async (change: any) => {
                const data = change.doc.data();
                const myUuid = localStorage.getItem('device_uuid');

                // Only process additions that are PENDING (or undefined status)
                // And not from me
                if (change.type === 'added' && myUuid && data['requesterUuid'] !== myUuid) {
                    if (!data['status'] || data['status'] === 'pending') {
                        this.tryLockAndProcess(uid, change.doc.id, data);
                    }
                }
            });
        });
    }

    async tryLockAndProcess(uid: string, reqId: string, data: any) {
        const myUuid = localStorage.getItem('device_uuid');
        const docRef = doc(this.db, 'users', uid, 'sync_requests', reqId);

        try {
            // Attempt to Lock
            await updateDoc(docRef, {
                status: 'processing',
                processorUuid: myUuid,
                processedAt: Date.now()
            });

            // If lock success, process
            await this.processSyncRequest(uid, reqId, data);

        } catch (e) {
            // Lock failed (someone else took it), ignore
            this.logger.log("Sync request locked by another device");
        }
    }

    async processSyncRequest(uid: string, reqId: string, data: any) {
        const targetUuid = data['requesterUuid'];
        const targetPubK = data['requesterPubK'];
        this.logger.log("Processing History Sync for", targetUuid);

        // Fetch Top 5 Active Chats
        const chatsRef = collection(this.db, 'chats');
        const qChats = query(chatsRef, where('participants', 'array-contains', uid), orderBy('lastTimestamp', 'desc'), limit(5));
        const chatSnaps = await getDocs(qChats);

        for (const chatDoc of chatSnaps.docs) {
            const chatId = chatDoc.id;

            // Pagination Logic for Larger History (Performance)
            let lastDoc = null;
            let hasMore = true;
            let count = 0;
            const MAX_HISTORY = 200; // Limit per chat

            while (hasMore && count < MAX_HISTORY) {
                const msgsRef = collection(this.db, 'chats', chatId, 'messages');
                let qMsgs;

                if (lastDoc) {
                    qMsgs = query(msgsRef, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(50));
                } else {
                    qMsgs = query(msgsRef, orderBy('timestamp', 'desc'), limit(50));
                }

                const msgSnaps: any = await getDocs(qMsgs);
                if (msgSnaps.empty) {
                    hasMore = false;
                    break;
                }

                for (const msgD of msgSnaps.docs) {
                    lastDoc = msgD;
                    count++;
                    const msgData = msgD.data();

                    // Skip if too old (e.g. > 30 days)
                    if (msgData['timestamp'] < (Date.now() - 30 * 24 * 60 * 60 * 1000)) {
                        hasMore = false;
                        break;
                    }

                    if (msgData['keys'] && msgData['keys'][uid]) {
                        const userKeys = msgData['keys'][uid];
                        if (typeof userKeys === 'object' && userKeys[targetUuid]) continue;

                        // Re-encrypt
                        await this.reEncryptMessageKey(chatId, msgD.id, msgData, targetUuid, targetPubK, uid);
                    }
                }

                // Yield to UI thread to prevent freeze
                await new Promise(r => setTimeout(r, 50));
            }
        }

        await deleteDoc(doc(this.db, 'users', uid, 'sync_requests', reqId));
        this.logger.log("History Sync Completed");
    }

    async reEncryptMessageKey(chatId: string, msgId: string, msgData: any, targetUuid: string, targetPubK: string, myId: string) {
        try {
            let myEncKey = msgData['keys'][myId];
            if (!myEncKey) return;

            const myDeviceUuid = localStorage.getItem('device_uuid');
            if (typeof myEncKey === 'object') {
                if (myDeviceUuid && myEncKey[myDeviceUuid]) myEncKey = myEncKey[myDeviceUuid];
                else if (myEncKey['primary']) myEncKey = myEncKey['primary'];
                else myEncKey = Object.values(myEncKey)[0];
            }

            const myPrivKey = localStorage.getItem('private_key');
            if (!myPrivKey) return;

            const sessionKey = await this.crypto.decryptAesKeyFromSender(myEncKey, myPrivKey);
            const newEncKey = await this.crypto.encryptAesKeyForRecipient(sessionKey, targetPubK);

            let updatePayload: any = {};
            // If current is string, convert to map
            if (typeof msgData['keys'][myId] === 'string') {
                const legacyKey = msgData['keys'][myId];
                updatePayload[`keys.${myId}`] = { primary: legacyKey, [targetUuid]: newEncKey };
            } else {
                updatePayload[`keys.${myId}.${targetUuid}`] = newEncKey;
            }

            await updateDoc(doc(this.db, 'chats', chatId, 'messages', msgId), updatePayload);

        } catch (e) {
            this.logger.error("Re-encrypt failed", e);
        }
    }
}
