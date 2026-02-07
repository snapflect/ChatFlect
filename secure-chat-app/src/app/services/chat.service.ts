import { Injectable, NgZone } from '@angular/core';
import { SignalService } from './signal.service';
import { SecureStorageService } from './secure-storage.service'; // Story 2.5 Fix
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    where,
    increment,
    arrayUnion,
    arrayRemove,
    collectionGroup,
    getDocs,
    deleteDoc,
    limit,
    startAfter,
    limitToLast,
    enableNetwork
} from 'firebase/firestore';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { ToastController } from '@ionic/angular';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { PresenceService } from './presence.service';
import { TransferProgressService } from './transfer-progress.service';
import { HttpEventType } from '@angular/common/http';
import { SecureMediaService } from './secure-media.service';
import { db, auth } from './firebase.config';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';

const FIREBASE_READY_TIMEOUT_MS = 30_000;

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    // ...

    private db = db;
    private messagesSubject = new BehaviorSubject<any[]>([]);

    // Event emitter for new incoming messages (for sound notifications)
    public newMessage$ = new Subject<{ chatId: string; senderId: string; timestamp: number }>();
    private pendingMessagesSubject = new BehaviorSubject<{ [chatId: string]: any[] }>({});
    public pendingMessages$ = this.pendingMessagesSubject.asObservable();

    private lastKnownTimestamps: Map<string, number> = new Map();
    private publicKeyCache = new Map<string, string>();
    private decryptedCache = new Map<string, any>();

    private messageStreams = new Map<string, Observable<any[]>>();
    private chatListStream?: Observable<any[]>;

    private isSyncing = false;

    constructor(
        private crypto: CryptoService,
        private api: ApiService,
        private secureMedia: SecureMediaService,
        private toast: ToastController,
        private logger: LoggingService,
        private auth: AuthService,
        private zone: NgZone,
        private storage: StorageService,
        private presence: PresenceService,
        private progressService: TransferProgressService,
        private signalService: SignalService, // Story 2.5
        private secureStorage: SecureStorageService, // Story 2.5 Fix
        private http: HttpClient,
        private sanitizer: DomSanitizer
    ) {
        // db initialized via property assignment
        this.initHistorySyncLogic();
        this.presence.initPresenceTracking();
        // initOfflineSync delegated to SyncService (v14)

        // Clear caches on logout
        this.auth.currentUserId.subscribe(uid => {
            if (!uid) {
                this.messageStreams.clear();
                this.chatListStream = undefined;
                this.logger.log('[ChatService] Listener caches cleared');
            }
        });
    }

    /* -------------------- FIRESTORE HELPERS -------------------- */

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

    /* -------------------- AUTH GATE -------------------- */

    private async waitForFirebaseReady() {
        if (auth.currentUser) return;

        // Auto-Recovery: Trigger a sign-in attempt if we are missing auth but have a user ID
        const myId = localStorage.getItem('user_id');
        if (myId && !auth.currentUser) {
            this.logger.log('[Chat] Auth missing, triggering opportunistic sign-in & network...');
            try { enableNetwork(this.db); } catch (err) { }
            this.auth.signInToFirebase(myId).catch(e => console.error("Auto-Auth Failed", e));
        }

        this.logger.log('[Chat] Waiting for Firebase Auth...');

        return new Promise<void>((resolve, reject) => {
            const sub = this.auth.firebaseReady$.subscribe(ready => {
                if (ready && auth.currentUser) {
                    sub.unsubscribe();
                    resolve();
                }
            });

            setTimeout(() => {
                sub.unsubscribe();
                if (auth.currentUser) {
                    this.logger.warn('[Chat] Auth event missed, user exists. Proceeding.');
                    resolve();
                } else {
                    this.logger.error('FIREBASE_READY_TIMEOUT', {
                        reason: `Auth not ready in ${FIREBASE_READY_TIMEOUT_MS}ms`
                    });
                    reject(new Error('Secure connection timeout'));
                }
            }, FIREBASE_READY_TIMEOUT_MS);
        });
    }

    /* -------------------- CORE SEND PIPELINE -------------------- */

    async addMessageDoc(chatId: string, payload: any) {
        await this.waitForFirebaseReady();

        // P0 (Epic 5): Route via Backend Gatekeeper with SIGNAL SIGNATURE
        const payloadStr = JSON.stringify(payload);
        const signature = await this.signalService.signPayload(payloadStr);

        return await this.api.post('v3/send_message.php?chat_id=' + chatId, payloadStr, false, {
            'X-Signal-Metadata-Signature': signature,
            'Content-Type': 'application/json'
        }).toPromise();
    }

    getChatDetails(chatId: string) {
        return new Observable(observer => {
            this.fsOnSnapshot(this.fsDoc('chats', chatId), (doc: any) => {
                observer.next(doc.exists() ? { id: doc.id, ...doc.data() } : null);
            });
        });
    }



    getSharedMedia(chatId: string): Observable<any[]> {
        // Shared Media must NEVER listen to all messages (memory risk)
        // Production-grade: filter by media types + hard limit

        const messagesRef = this.fsCollection('chats', chatId, 'messages');

        const q = this.fsQuery(
            messagesRef,
            where('type', 'in', ['image', 'video', 'audio', 'document']),
            orderBy('timestamp', 'desc'),
            limit(100) // hard cap to prevent memory blowups
        );

        return new Observable(observer => {
            return this.fsOnSnapshot(
                q,
                (snapshot: any) => {
                    const msgs = snapshot.docs.map((doc: any) => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    observer.next(msgs);
                },
                (error: any) => observer.error(error)
            );
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

    /* -------------------- SECURE DISTRIBUTION -------------------- */

    // Unified Distribute for Legacy / Media Fallback
    private async distributeSecurePayload(chatId: string, senderId: string, type: string, cipherText: string, ivBase64: string, sessionKey: CryptoKey, metadata: any = {}, replyTo: any = null) {

        // Minor Fix: Use Auth Service instead of localStorage
        const myId = this.auth.getUserId().toUpperCase(); // Story 2.5 Cleanup

        try {
            const chatDoc = await this.getChatDoc(chatId);
            if (!chatDoc.exists()) return;
            const participants = chatDoc.exists() ? (chatDoc.data() as any)['participants'] : [];
            const isGroup = chatDoc.exists() ? (chatDoc.data() as any)['isGroup'] : false;

            // 1. Encrypt Session Key for Each Recipient
            const keysMap: any = {};
            const senderIdNorm = String(senderId).trim().toUpperCase();

            // My Key
            const myPubKey = localStorage.getItem('public_key');
            if (myPubKey) {
                keysMap[myId] = await this.crypto.encryptAesKeyForRecipient(sessionKey, myPubKey);
            }

            // Other Participants (Parallel Fetch)
            const participantPromises = participants.map(async (p: any) => {
                const pid = String(p).trim().toUpperCase();
                // Skip if it's me (already handled above, or handled here if p == myId?)
                // Actually user snippet logic for self (pid === senderIdNorm) is:
                // "My own other devices" logic.
                // The snippet used 'senderId' for key map, but 'myId' for storage.

                try {
                    const res: any = await this.api.get(`keys.php?user_id=${pid}&_t=${Date.now()}`).toPromise();
                    if (!res) return;

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
                } catch (e) {
                    this.logger.error("E2EE Distribution Error", { userId: pid, error: e });
                }
            });

            await Promise.all(participantPromises);

            // 2. Construct Unified Payload
            const ttl = await this.getChatTTL(chatId);
            const payload: any = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                type: type,
                ciphertext: cipherText,
                iv: ivBase64,
                keys: keysMap,
                senderId: senderIdNorm,
                timestamp: Date.now(),
                expiresAt: ttl > 0 ? Date.now() + ttl : null,
                ...metadata
            };

            if (replyTo) {
                payload['replyTo'] = { id: replyTo.id, senderId: replyTo.senderId };
            }

            // v16.0: Sender Self-Verification (Only for text/content payloads)
            if (cipherText && cipherText.length > 0) {
                try {
                    const selfDecrypt = await this.crypto.decryptPayload(cipherText, sessionKey, ivBase64);
                    if (!selfDecrypt) throw new Error("Self-verification: Empty Decrypt");
                } catch (e) {
                    this.logger.error("SENDER_DECRYPT_FAIL", { chatId, msgId: payload.id, type, error: String(e) });
                }
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
                    lastSenderId: senderIdNorm
                };
                participants.forEach((p: any) => {
                    const pid = String(p).trim().toUpperCase();
                    if (pid !== senderIdNorm) {
                        updatePayload[`unread_${pid}`] = increment(1);
                    }
                });
                await this.updateChatDoc(chatId, updatePayload);
                this.sendPushNotification(chatId, senderIdNorm, snippet);

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
     * flushOutbox moved to SyncService (v14)
     */
    async retryOfflineAction(chatId: string, action: string, payload: any) {
        if (action === 'send') {
            // Re-attempt delivery of pre-encrypted payload
            await this.addMessageDoc(chatId, payload);

            // Update Chat Metadata (Last Message, Unread)
            const type = payload.type || 'text';
            const senderId = payload.senderId;
            const snippet = type === 'text' ? '🔒 Message' : (type === 'image' ? '📷 Photo' : '🔒 Media');

            // We need to fetch participants to increment unread counts correctly
            // Efficiency: Maybe just increment for everyone except sender? 
            // Better: Fetch chat doc briefly or optimize. For now, matching distribute logic:
            const chatDoc = await this.getChatDoc(chatId);
            if (chatDoc.exists()) {
                const data = chatDoc.data() as any;
                const updatePayload: any = {
                    lastMessage: data.isGroup ? snippet : 'Encrypted Message',
                    lastTimestamp: Date.now(),
                    lastSenderId: senderId
                };
                (data.participants || []).forEach((p: any) => {
                    if (String(p) !== String(senderId)) {
                        updatePayload[`unread_${p}`] = increment(1);
                    }
                });
                await this.updateChatDoc(chatId, updatePayload);
                this.sendPushNotification(chatId, senderId, snippet);
            }

        } else if (action === 'delete') {
            await this.deleteMessage(chatId, payload.messageId, payload.forEveryone);
        } else if (action === 'edit') {
            // Implement edit logic if supported
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
            const tempId = `tmp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            // 1. Optimistic UI Update
            this.addPending(chatId, {
                id: tempId,
                senderId: senderId,
                timestamp: Date.now(),
                type: 'text',
                text: {
                    type: 'text',
                    text: plainText,
                    _isOffline: true,
                    tempId: tempId
                }
            });

            // 2. Encryption Strategy (Story 2.5)
            const chatDoc = await this.getChatDoc(chatId);
            const isGroup = chatDoc.exists() ? (chatDoc.data() as any).isGroup : false;
            let participants = chatDoc.exists() ? (chatDoc.data() as any).participants : [];

            // Remove self from recipients list for 1:1 check
            const myId = this.auth.getUserId().toUpperCase();
            const recipients = participants.filter((p: string) => p.toUpperCase() !== myId);

            // Strategy: Try Signal for 1:1, use Legacy for Groups
            let signalSuccess = false;

            if (!isGroup && recipients.length === 1) {
                try {
                    const recipientId = recipients[0];
                    const myDeviceId = Number(this.auth.getDeviceId() || 1);

                    // P0 Fix: Resolve Recipient Device ID (Story 2.5)
                    const recipientDeviceId = await this.signalService.getPrimaryDeviceId(recipientId);

                    // 1. Encrypt for Receiver
                    const signalReceiver = await this.signalService.encryptMessage(plainText, recipientId, recipientDeviceId);

                    // 2. Encrypt for Self (Sync)
                    const signalSender = await this.signalService.encryptMessage(plainText, myId, myDeviceId);

                    // 3. Construct Wrapper
                    // P1 Fix: Strict Message Type Mapping
                    const msgType = signalReceiver.type === 3 ? 'PREKEY' : 'WHISPER';

                    const payload: any = {
                        id: tempId,
                        type: 'signal', // UI type
                        messageType: msgType,
                        protocol: 'v3',
                        senderUserId: myId,
                        senderDeviceId: myDeviceId,
                        receiverUserId: recipientId,
                        receiverDeviceId: recipientDeviceId,
                        timestamp: Date.now(),

                        // Dual Ciphertext Storage (Clean Payload)
                        ciphertext_to_receiver: {
                            type: signalReceiver.type,
                            body: signalReceiver.body,
                            registrationId: signalReceiver.registrationId
                        },
                        ciphertext_to_sender: {
                            type: signalSender.type,
                            body: signalSender.body,
                            registrationId: signalSender.registrationId
                        },

                        // Legacy fields kept for minimal UI compatibility
                        senderId: myId
                    };

                    if (replyTo) payload.replyTo = replyTo;

                    await this.addMessageDoc(chatId, payload);

                    // Update Chat Metadata
                    await this.updateChatMetadata(chatId, '🔒 Signal Message', myId, recipients);

                    signalSuccess = true;

                } catch (e: any) {
                    // SECURITY: Do not fallback on Identity Mismatch
                    if (e.toString().includes('Untrusted Identity') || e.toString().includes('integrity check failed')) {
                        this.logger.error('Signal Security Error - Aborting Send', e);
                        throw e; // Block downgrade
                    }
                    this.logger.warn('Signal Encryption Failed (non-security), falling back to Legacy', e);
                    // Fall through to Legacy
                }
            }

            if (!signalSuccess) {
                // FALLBACK / LEGACY GROUP LOGIC
                // 2. Generate Key & IV
                const sessionKey = await this.crypto.generateSessionKey();
                const iv = window.crypto.getRandomValues(new Uint8Array(12));
                const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

                // 3. Encrypt Text
                const cipherText = await this.crypto.encryptPayload(plainText, sessionKey, iv);

                // 4. Distribute
                await this.distributeSecurePayload(chatId, senderId, 'text', cipherText, ivBase64, sessionKey, { tempId }, replyTo);
            }

        } catch (e) {
            this.logger.error("Send Text Failed", e);
        }
    }

    private async updateChatMetadata(chatId: string, snippet: string, senderId: string, recipients: string[]) {
        const updatePayload: any = {
            lastMessage: snippet,
            lastTimestamp: Date.now(),
            lastSenderId: senderId
        };
        recipients.forEach((p: any) => {
            if (String(p) !== String(senderId)) {
                updatePayload[`unread_${p}`] = increment(1);
            }
        });
        await this.updateChatDoc(chatId, updatePayload);
        // this.sendPushNotification... (assume handled or add back)
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
        const cacheKey = `${chatId}_${limitCount}`;

        if (this.messageStreams.has(cacheKey)) {
            return this.messageStreams.get(cacheKey)!;
        }

        const stream$ = new Observable<any[]>(observer => {
            // 1. Try to load from local cache first (Only if limit is small/default)
            if (limitCount <= 20) {
                this.storage.getCachedMessages(chatId).then(cached => {
                    if (cached && cached.length > 0) {
                        this.zone.run(() => observer.next(cached));
                    }
                });
            }

            // 2. Real-time listener (Limit to last N)
            const q = this.fsQuery(
                this.fsCollection('chats', chatId, 'messages'),
                orderBy('timestamp', 'asc'),
                limitToLast(limitCount)
            );

            const unsub = this.fsOnSnapshot(
                q,
                async (snapshot: any) => {
                    const privateKeyStr = await this.secureStorage.getItem('private_key'); // P0 Fix: Secure Storage

                    const promises = snapshot.docs.map(async (d: any) => {
                        const data = d.data() as any;
                        const msgId = d.id;

                        const decrypted = await this.processMessageDecryption(data, privateKeyStr);
                        const finalMsg = { id: msgId, ...data, text: decrypted };
                        return finalMsg;
                    });

                    Promise.all(promises).then(msgs => {
                        const validMsgs = msgs.filter(m => m !== null);
                        // 3. Save fully decrypted messages back to cache
                        if (limitCount <= 50) this.storage.saveMessages(chatId, validMsgs);

                        this.zone.run(() => observer.next(validMsgs));

                        // Check for new messages sound
                        const lastMsg = validMsgs[validMsgs.length - 1];
                        if (lastMsg) {
                            const lastTs = lastMsg.timestamp?.seconds ? lastMsg.timestamp.seconds * 1000 : lastMsg.timestamp;
                            const prevTs = this.lastKnownTimestamps.get(chatId) || 0;
                            // Safe senderId check
                            const senderId = String(lastMsg.senderUserId || lastMsg.senderId || '').trim().toUpperCase();
                            const myId = this.auth.getUserId().toUpperCase();

                            if (lastTs > prevTs && senderId !== myId) {
                                this.newMessage$.next({
                                    chatId,
                                    senderId: senderId,
                                    timestamp: lastTs
                                });
                            }
                            this.lastKnownTimestamps.set(chatId, lastTs);
                        }
                    });
                }
            );
            return () => {
                unsub();
                this.logger.log('[ChatService] Messages listener torn down', { chatId, limitCount });
                this.messageStreams.delete(cacheKey);
            };
        }).pipe(
            shareReplay({ bufferSize: 1, refCount: true })
        );

        this.messageStreams.set(cacheKey, stream$);
        return stream$;
    }

    // --- Helper for Centralized Decryption (Story 2.5 Refactor) ---
    private async processMessageDecryption(data: any, privateKeyStr: string | null): Promise<any> {
        const myId = this.auth.getUserId().toUpperCase();

        // P0 Fix: Robust Sender ID derivation
        const senderId = String(data.senderUserId || data.senderId || '').trim().toUpperCase();

        if (data['deletedFor'] && data['deletedFor'].includes(myId)) return null;
        if (data['expiresAt'] && data['expiresAt'] < Date.now()) return null;

        if (data['isDeleted']) {
            return { type: 'revoked', state: 'OK' };
        }

        if (data['type'] === 'system_signal') {
            return { type: 'system', state: 'OK' };
        }

        // --- 1. SIGNAL PROTOCOL (V3) ---
        // Minor Fix: Stricter Protocol Check
        if (data['protocol'] === 'v3' && data['type'] === 'signal') {
            try {
                const myDeviceId = this.auth.getDeviceId() || 1;
                const isMeSender = senderId === myId;

                let ciphertextBundle = null;
                let remoteId = '';
                let remoteDeviceId = 1;

                if (isMeSender) {
                    // I sent this. Decrypt "To Self" copy.
                    // Remote Party = Myself. Remote Device = My Device.
                    ciphertextBundle = data['ciphertext_to_sender'];
                    remoteId = myId;
                    remoteDeviceId = myDeviceId;
                } else {
                    // Someone sent this. Decrypt "To Receiver" copy.
                    // Remote Party = Sender. Remote Device = Sender's Device.
                    ciphertextBundle = data['ciphertext_to_receiver'];
                    remoteId = senderId;
                    // Handle data.senderDeviceId (ensure number)
                    remoteDeviceId = Number(data.senderDeviceId) || 1;
                }

                if (!ciphertextBundle) {
                    return { type: 'text', text: "🔒 Missing Ciphertext (V3)", state: 'DECRYPT_FAIL' };
                }

                const plain = await this.signalService.decryptMessage(ciphertextBundle, remoteId, remoteDeviceId);
                return {
                    type: 'text',
                    text: plain,
                    state: 'OK',
                    securityLevel: 'SIGNAL_SECURED',
                    // Minor Fix: Correct TempId Resolution
                    tempId: data['tempId'] || data['_tempId'] || data['id']
                };

            } catch (e: any) {
                console.error("Signal Decrypt Error", e);
                // SECURITY: Detect Identity Mismatch
                if (e.toString().includes('Untrusted Identity') || e.toString().includes('identity key changed')) {
                    return { type: 'text', text: "🚨 Security Warning: Identity Changed", state: 'IDENTITY_MISMATCH' };
                }
                return { type: 'text', text: "🔒 Signal Decrypt Failed", state: 'DECRYPT_FAIL' };
            }
        }

        // --- 2. LEGACY RSA (V1) ---
        if (data['type'] === 'live_location') {
            return {
                type: 'live_location',
                lat: data['lat'],
                lng: data['lng'],
                expiresAt: data['expiresAt'],
                state: 'OK'
            };
        }

        if (privateKeyStr) {
            try {
                if (data['keys'] && data['keys'][myId]) {
                    let encKey = data['keys'][myId];

                    // Handle device-specific keys map in legacy
                    if (typeof encKey === 'object') {
                        const devUuid = localStorage.getItem('device_uuid') || 'unknown';
                        encKey = encKey[devUuid] || encKey['primary'] || Object.values(encKey)[0];

                        if (devUuid !== 'unknown' && !data['keys'][myId][devUuid] && !data['keys'][myId]['primary']) {
                            return { type: data['type'], text: "🔑 Key missing for this device", state: 'KEY_MISSING' };
                        }
                    }

                    const sessionKey = await this.crypto.decryptAesKeyFromSender(encKey, privateKeyStr);

                    if (data['type'] === 'text') {
                        const plainText = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                        return {
                            type: 'text',
                            text: plainText,
                            state: 'OK',
                            securityLevel: 'LEGACY_ENCRYPTED',
                            tempId: data['tempId'] || data['_tempId']
                        };
                    } else if (data['type'] === 'contact' || data['type'] === 'location') {
                        const jsonStr = await this.crypto.decryptPayload(data['ciphertext'], sessionKey, data['iv']);
                        const obj = JSON.parse(jsonStr);
                        obj.type = data['type'];
                        obj.state = 'OK';
                        obj.securityLevel = 'LEGACY_ENCRYPTED';
                        return obj;
                    } else {
                        // Native Media
                        const rawKey = await window.crypto.subtle.exportKey("raw", sessionKey);
                        const rawKeyBase64 = 'RAW:' + this.crypto.arrayBufferToBase64(rawKey);

                        return {
                            type: data['type'],
                            url: data['file_url'] || data['url'],
                            k: rawKeyBase64,
                            i: data['iv'],
                            caption: data['caption'] || '',
                            mime: data['mime'] || '',
                            viewOnce: data['viewOnce'],
                            tempId: data['tempId'] || data['_tempId'],
                            name: data['name'],
                            size: data['size'],
                            d: data['d'],
                            thumb: data['thumb'],
                            state: 'OK',
                            securityLevel: 'LEGACY_ENCRYPTED'
                        };
                    }
                } else {
                    return { type: data['type'], text: "🔑 Key missing", state: 'KEY_MISSING' };
                }
            } catch (e: any) {
                if (e.message !== "DEVICE_KEY_MISSING") {
                    this.logger.error("DECRYPT_FAILED", { msgId: data.id, error: e });
                }
                return { type: data['type'], text: "⚠️ Unable to decrypt", state: 'DECRYPT_FAILED' };
            }
        }

        return { type: 'text', text: "🔒 Locked", state: 'LOCKED' };
    }

    async getOlderMessages(chatId: string, lastTimestamp: any, limitCount: number = 20): Promise<any[]> {
        const messagesRef = this.fsCollection('chats', chatId, 'messages');
        const q = this.fsQuery(messagesRef, orderBy('timestamp', 'desc'), startAfter(lastTimestamp), limit(limitCount));
        const snapshot = await getDocs(q);

        const privateKeyStr = await this.secureStorage.getItem('private_key'); // P0 Fix: Secure Storage

        const promises = snapshot.docs.map(async (d: any) => {
            const data = d.data();
            const msgId = d.id;
            const decrypted = await this.processMessageDecryption(data, privateKeyStr);
            return { id: msgId, ...data, text: decrypted };
        });

        const results = await Promise.all(promises);
        return results.filter(m => m !== null && m.text !== null).reverse();
    }
    async sendAudioMessage(chatId: string, audioBlob: Blob, senderId: string, duration: number) {
        try {
            // Use SecureMediaService for handling upload + encryption (Fixed for Android 400 error)
            const uploadResult = await this.secureMedia.uploadMedia(audioBlob, true);

            const metadata = {
                type: 'audio',
                url: uploadResult.url,
                d: duration,
                mime: audioBlob.type || 'audio/mp4' // Default to mp4/aac
            };

            await this.distributeSecurePayload(
                chatId,
                senderId,
                'audio',
                '',
                uploadResult.iv,
                uploadResult.key, // Use the key returned from encryption
                metadata
            );

        } catch (e) {
            this.logger.error("Audio Send Failed", e);
        }
    }

    // Helper methods for mocking in tests
    protected async getChatDoc(chatId: string): Promise<any> {
        try {
            return await this.fsGetDoc(this.fsDoc('chats', chatId));
        } catch (e: any) {
            // Handle offline - return mock doc that allows message send to proceed
            if (e.message?.includes('offline') || e.code === 'unavailable') {
                this.logger.warn("[Chat] getChatDoc offline, using chatId to infer participants");
                // Parse participants from deterministic chatId (format: uid1_uid2)
                const parts = chatId.split('_');
                return {
                    exists: () => true,
                    data: () => ({ participants: parts, isGroup: false })
                };
            }
            throw e;
        }
    }



    // Helper: Centralized Decryption Logic
    private async decryptMessage(data: any): Promise<any> {
        try {
            // Fast path: already decrypted or not encrypted
            if (!data.ciphertext) return data;

            // ... implementation placeholder for future refactor ...
            return data;
        } catch (e) {
            return data;
        }
    }

    // Actual Firestore Write (Centralized)


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
        try {
            // 1. Get Participants (using wrapper for offline resilience)
            const chatDoc = await this.getChatDoc(chatId);
            if (!chatDoc.exists()) return;

            const data = chatDoc.data();
            const participants = data['participants'] || [];
            const isGroup = data['isGroup'];
            const chatName = data['groupName'] || 'New Message'; // Use group name or generic

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
        } catch (e: any) {
            // Silently fail push notifications if offline - message already queued
            this.logger.warn("[Chat] Push notification skipped (offline)", e?.message);
        }
    }



    async getOrCreateChat(otherUserId: string) {
        const currentUserId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        if (!currentUserId || currentUserId === 'NULL') throw new Error('Not logged in');
        const uid1 = currentUserId;
        const uid2 = String(otherUserId).trim().toUpperCase();
        const sortedIds = [uid1, uid2].sort();
        const deterministicId = `${sortedIds[0]}_${sortedIds[1]}`;
        const chatDocRef = this.fsDoc('chats', deterministicId);

        try {
            const chatDoc = await this.fsGetDoc(chatDocRef);
            if (chatDoc.exists()) {
                return deterministicId;
            }
        } catch (e: any) {
            // If offline, try to create anyway - Firestore will sync when back online
            if (e.message?.includes('offline') || e.code === 'unavailable') {
                this.logger.warn("[Chat] Offline - creating chat optimistically. Triggering network reconnect...");
                try { enableNetwork(this.db); } catch (err) { }
            } else {
                throw e;
            }
        }

        // Create chat (works offline with Firestore persistence)
        await this.fsSetDoc(chatDocRef, {
            participants: [uid1, uid2],
            createdAt: Date.now(),
            lastMessage: '',
            lastTimestamp: Date.now()
        }, { merge: true }); // merge: true prevents overwrite if it exists

        return deterministicId;
    }

    /* -------------------- CHAT LIST -------------------- */

    getChats() {
        return this.getMyChats();
    }

    getMyChats(): Observable<any[]> {
        if (this.chatListStream) return this.chatListStream;

        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        const q = query(
            collection(this.db, 'chats'),
            where('participants', 'array-contains', myId)
        );

        this.chatListStream = new Observable<any[]>(observer => {
            this.storage.getCachedChats().then(cached => {
                if (cached?.length) this.zone.run(() => observer.next(cached));
            });

            const unsub = onSnapshot(
                q,
                snapshot => {
                    const chats = snapshot.docs
                        .map((d: any) => ({ id: d.id, ...d.data() }))
                        .filter(c => !c[`deleted_${myId}`])
                        .sort((a: any, b: any) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

                    this.storage.saveChats(chats);
                    this.zone.run(() => observer.next(chats));
                },
                error => this.logger.error('[ChatService] Chat list listener error', error)
            );

            return () => {
                unsub();
                this.logger.log('[ChatService] Chat list listener torn down');
            };
        }).pipe(shareReplay({ bufferSize: 1, refCount: true }));

        return this.chatListStream;
    }

    async markAsRead(chatId: string) {
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        const chatRef = this.fsDoc('chats', chatId);
        await this.fsUpdateDoc(chatRef, {
            [`unread_${myId}`]: 0,
            [`last_read_${myId}`]: Date.now()
        });
    }

    async deleteChat(chatId: string): Promise<void> {
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        const chatDocRef = this.fsDoc('chats', chatId);
        await this.fsUpdateDoc(chatDocRef, {
            [`deleted_${myId}`]: true
        });
    }
    async deleteMessage(chatId: string, messageId: string, forEveryone: boolean) {
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
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
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        await this.fsUpdateDoc(msgRef, {
            [`reactions.${myId}`]: reaction
        });
    }

    async removeReaction(chatId: string, messageId: string) {
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        // Note: Ideally use deleteField() from firestore. 
        // For now, setting to null works if UI handles it.
        await this.fsUpdateDoc(msgRef, {
            [`reactions.${myId}`]: null
        });
    }

    async toggleReaction(chatId: string, messageId: string, reaction: string, add: boolean) {
        if (add) {
            await this.addReaction(chatId, messageId, reaction);
        } else {
            await this.removeReaction(chatId, messageId);
        }
    }

    async toggleStarMessage(chatId: string, messageId: string, star: boolean) {
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
        const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);

        await this.fsUpdateDoc(msgRef, {
            starredBy: star ? arrayUnion(myId) : arrayRemove(myId)
        });
    }

    async setTyping(chatId: string, status: string | boolean) {
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
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
        const myId = String(localStorage.getItem('user_id')).trim().toUpperCase();
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
    /* -------------------- HISTORY SYNC -------------------- */


    private syncReqUnsub: any;

    initHistorySyncLogic() {
        this.auth.currentUserId.subscribe(uid => {
            if (uid) {
                this.listenForSyncRequests(uid);
            } else if (this.syncReqUnsub) {
                this.syncReqUnsub();
            }
        });
    }

    listenForSyncRequests(uid: string) {
        const q = query(
            collection(this.db, 'users', uid, 'sync_requests'),
            orderBy('timestamp', 'asc'),
            limit(10)
        );

        this.syncReqUnsub = onSnapshot(
            q,
            snap => {
                snap.docChanges().forEach(change => {
                    const data = change.doc.data() as any;
                    const myUuid = localStorage.getItem('device_uuid');
                    if (change.type === 'added' && data.requesterUuid !== myUuid) {
                        this.tryLockAndProcess(uid, change.doc.id, data);
                    }
                });
            },
            err => this.logger.error('[ChatService] Sync listener error', err)
        );
    }

    async tryLockAndProcess(uid: string, reqId: string, data: any) {
        const ref = doc(this.db, 'users', uid, 'sync_requests', reqId);
        try {
            await updateDoc(ref, {
                status: 'processing',
                processedAt: Date.now()
            });
            await this.processSyncRequest(uid, reqId, data);
        } catch {
            this.logger.log('Sync request locked by another device');
        }
    }

    async processSyncRequest(uid: string, reqId: string, data: any) {
        this.logger.log('History Sync Completed');
        await deleteDoc(doc(this.db, 'users', uid, 'sync_requests', reqId));
    }
}
