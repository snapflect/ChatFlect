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
import { HttpEventType, HttpClient } from '@angular/common/http';
import { Network } from '@capacitor/network';
import { LocalDbService } from './local-db.service';
import { RetrySchedulerService } from './retry-scheduler.service';
import { MessageAckService } from './message-ack.service';
import { SignalStoreService } from './signal-store.service';

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
        private http: HttpClient,
        private toast: ToastController,
        private logger: LoggingService,
        private auth: AuthService,
        private zone: NgZone,
        private storage: StorageService,
        private localDb: LocalDbService,
        private retryScheduler: RetrySchedulerService,
        private ackService: MessageAckService,
        private signalStore: SignalStoreService,
        private presence: PresenceService,
        private progressService: TransferProgressService
    ) {
        this.initFirestore();
        this.initHistorySyncLogic();
        this.presence.initPresenceTracking();

        // Start Reliability Engines
        this.retryScheduler.start();
        this.ackService.start();

        // One-time sync on start
        this.syncInbox();
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
        return new Observable(observer => {
            const loadMedia = async () => {
                try {
                    const rows = await this.localDb.query(`
                        SELECT * FROM local_messages 
                        WHERE chat_id = ? AND type IN ('image', 'video', 'document', 'audio')
                        ORDER BY COALESCE(server_timestamp, timestamp) DESC
                    `, [chatId]);

                    const msgs = rows.map((row: any) => {
                        let payload: any = {};
                        try {
                            payload = JSON.parse(row.payload);
                        } catch (e) { }

                        return {
                            id: row.id,
                            ...row,
                            ...payload,
                            timestamp: row.server_timestamp || row.timestamp
                        };
                    });
                    this.zone.run(() => observer.next(msgs));
                } catch (err) {
                    this.logger.error('[ChatService] getSharedMedia Local DB Error', err);
                }
            };

            loadMedia();
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

    /**
     * HF-2.3C: Universal Sync (MySQL -> SQLite)
     * Rapidly pulls all pending messages for this device.
     */
    async syncInbox(): Promise<void> {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const response: any = await this.http.get(`${environment.apiUrl}/v4/messages/pull.php`).toPromise();

            if (response && response.success && Array.isArray(response.messages)) {
                for (const msg of response.messages) {
                    await this.persistIncomingMessage(msg);
                }
                this.logger.log(`[ChatService] Inbox synced. ${response.messages.length} new messages.`);
            }
        } catch (err) {
            this.logger.error('[ChatService] Inbox Sync Failed', err);
        } finally {
            this.isSyncing = false;
        }
    }

    private async persistIncomingMessage(msg: any): Promise<void> {
        // msg: { inbox_id, message_uuid, encrypted_payload, created_at, forwarding_score }
        try {
            // Deduplication (Enterprise HF-2.2 Check)
            const existing = await this.localDb.query('SELECT id FROM local_messages WHERE id = ?', [msg.message_uuid]);
            if (existing.length > 0) return;

            // Prepare local persistence
            // Note: We'd also handle decryption here or lazily in the UI
            await this.localDb.run(`
                INSERT INTO local_messages (id, server_id, chat_id, type, payload, timestamp, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                msg.message_uuid,
                msg.inbox_id,
                'temp_chat', // In a real app, we'd extract chat_id from payload headers
                'encrypted',
                msg.encrypted_payload,
                new Date(msg.created_at).getTime(),
                'delivered'
            ]);

            // Signal the UI or Notification logic
            this.newMessage$.next({ chatId: 'temp_chat', senderId: 'unknown', timestamp: Date.now() });

        } catch (err) {
            this.logger.warn('[ChatService] Failed to persist incoming message', err);
        }
    }

    /**
     * sendInternal (v2.3 Core Pipeline)
     * Handles local-first persistence, encryption, and queueing.
     */
    private async sendInternal(chatId: string, type: string, plainPayload: any, metadata: any = {}): Promise<string> {
        const myId = String(localStorage.getItem('user_id'));
        const messageId = window.crypto.randomUUID();

        try {
            // 1. Prepare Encrypted Envelope
            // Note: In a full Signal implementation, we'd encrypt for each participant here.
            // For now, we reuse the existing CryptoService AES-GCM logic or SignalStore sessions.
            // Requirement Check: "Always store encrypted on disk".

            const sessionKey = await this.crypto.generateSessionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer as ArrayBuffer);

            const cipherText = await this.crypto.encryptPayload(JSON.stringify(plainPayload), sessionKey, iv);

            // v2.3: We'd also encrypt the sessionKey for all recipients as in distributeSecurePayload
            // but we'll pack it into a single 'payload' blob for the server.

            const envelope = {
                ciphertext: cipherText,
                iv: ivBase64,
                type: type,
                ...metadata
            };

            // 2. Persist to SQLite (Never store plaintext)
            await this.localDb.run(`
                INSERT INTO local_messages (id, chat_id, sender_id, type, payload, timestamp, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [messageId, chatId, myId, type, JSON.stringify(envelope), Date.now(), 'pending']);

            // 3. Add to Reliability Queue
            await this.retryScheduler.addToQueue(messageId);

            // 4. Trigger Immediate Sync
            this.retryScheduler.processQueue();

            // 5. Update local UI state (Optimistic)
            // this.refreshMessagesForChat(chatId); // Placeholder for UI update logic

            return messageId;

        } catch (err) {
            this.logger.error('[ChatService] sendInternal Failed', err);
            throw err;
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
        return this.sendInternal(chatId, 'text', { content: plainText }, { replyTo });
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

            const tempId = window.crypto.randomUUID();
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

                    await this.sendInternal(chatId, 'image', { url: uploadRes.url, caption: caption }, metadata);
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

            const tempId = window.crypto.randomUUID();
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

                    await this.sendInternal(chatId, 'video', { url: uploadRes.url, caption: caption }, metadata);
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

            const tempId = window.crypto.randomUUID();
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

                    await this.sendInternal(chatId, 'document', { url: uploadRes.url, name: file.name }, metadata);
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
            const myId = String(localStorage.getItem('user_id'));
            const privateKeyStr = localStorage.getItem('private_key');

            const loadFromDb = async () => {
                try {
                    const rows = await this.localDb.query(`
                        SELECT * FROM local_messages 
                        WHERE chat_id = ? 
                        ORDER BY COALESCE(server_timestamp, timestamp) ASC 
                        LIMIT ?
                    `, [chatId, limitCount]);

                    const promises = rows.map(async (row: any) => {
                        let decrypted: any = "🔒 Decrypting...";
                        try {
                            const envelope = JSON.parse(row.payload);
                            // v2.3 decryption logic (assuming simple AES-GCM for now, 
                            // in a full Signal refactor this would use signalStore.loadSession)

                            const sessionKey = await this.crypto.generateSessionKey(); // Placeholder: Need real session key recovery
                            // Actually, we should preserve the decryption logic from the original getMessages
                            // which used the 'keys' field in the payload.

                            // For v2.3 paritial migration, we'll assume the payload IS the envelope we saved in sendInternal
                            if (envelope.ciphertext && envelope.iv) {
                                // dummy decryption for now since we haven't unified the key storage yet 
                                // but we follow the pattern
                                decrypted = JSON.parse(await this.crypto.decryptPayload(envelope.ciphertext, sessionKey, envelope.iv));
                            }
                        } catch (e) {
                            decrypted = "🔒 Decryption Failed";
                        }

                        return {
                            id: row.id,
                            ...row,
                            text: decrypted,
                            timestamp: row.server_timestamp || row.timestamp
                        };
                    });

                    const msgs = await Promise.all(promises);
                    this.zone.run(() => observer.next(msgs));
                } catch (err) {
                    this.logger.error('[ChatService] getMessages Local DB Error', err);
                }
            };

            loadFromDb();
            // In a real app, we'd also subscribe to a 'refresh' event or use a SQLite watcher
        });
    }

    async getOlderMessages(chatId: string, lastTimestamp: any, limitCount: number = 20): Promise<any[]> {
        try {
            const rows = await this.localDb.query(`
                SELECT * FROM local_messages 
                WHERE chat_id = ? AND COALESCE(server_timestamp, timestamp) < ?
                ORDER BY COALESCE(server_timestamp, timestamp) DESC 
                LIMIT ?
            `, [chatId, lastTimestamp, limitCount]);

            // Decryption logic same as getMessages (Refactor to helper in real app)
            return rows.reverse();
        } catch (err) {
            return [];
        }
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

            await this.sendInternal(chatId, 'audio', { url: uploadRes.url, d: duration }, metadata);

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

            await this.sendInternal(chatId, 'location', { lat, lng, label }, {});
        } catch (e) {
            this.logger.error("Location Send Failed", e);
        }
    }

    async sendLiveLocationMessage(chatId: string, lat: number, lng: number, senderId: string, durationMinutes: number) {
        try {
            const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
            const chatDoc = await this.getChatDoc(chatId);
            await this.sendInternal(chatId, 'live_location', { lat, lng, expiresAt }, { expiresAt });
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
            await this.sendInternal(chatId, 'sticker', { url }, metadata);
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

            await this.sendInternal(chatId, 'contact', payload, {});
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

    async getOrCreateChat(otherUserId: string): Promise<string> {
        const currentUserId = localStorage.getItem('user_id');
        if (!currentUserId) throw new Error('Not logged in');

        try {
            // Enterprise HF-3.3: MySQL-First Conversation Discovery
            const response: any = await this.http.post(`${environment.apiUrl}/v4/conversations/get_or_create.php`, {
                target_user_id: otherUserId
            }).toPromise();

            if (response && response.success && response.conversation_id) {
                this.logger.log(`[ChatService] Conversation ${response.conversation_id} resolved via backend.`);
                return response.conversation_id;
            } else {
                throw new Error(response?.message || 'Failed to resolve conversation');
            }
        } catch (err) {
            this.logger.error('[ChatService] getOrCreateChat Failed', err);

            // Fallback for dev/offline or if backend isn't ready: deterministic ID
            const uid1 = String(currentUserId);
            const uid2 = String(otherUserId);
            const sortedIds = [uid1, uid2].sort();
            return `${sortedIds[0]}_${sortedIds[1]}`;
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

    async toggleReaction(chatId: string, messageId: string, reaction: string, add: boolean) {
        if (add) {
            await this.addReaction(chatId, messageId, reaction);
        } else {
            await this.removeReaction(chatId, messageId);
        }
    }

    async toggleStarMessage(chatId: string, messageId: string, star: boolean) {
        // WhatsApp-Style: Local-First Starring
        try {
            await this.localDb.run("UPDATE local_messages SET is_starred = ? WHERE id = ?", [star ? 1 : 0, messageId]);

            // Optional: Backup to Firestore (Signal/WhatsApp typically don't unless doing cloud backup)
            const myId = String(localStorage.getItem('user_id'));
            const msgRef = this.fsDoc('chats', chatId, 'messages', messageId);
            await this.fsUpdateDoc(msgRef, {
                starredBy: star ? arrayUnion(myId) : arrayRemove(myId)
            });
        } catch (e) {
            this.logger.error("Toggle Star Failed", e);
        }
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
        return new Observable(observer => {
            const loadStarred = async () => {
                try {
                    const rows = await this.localDb.query(`
                        SELECT * FROM local_messages 
                        WHERE is_starred = 1 
                        ORDER BY COALESCE(server_timestamp, timestamp) DESC
                    `);

                    const msgs = rows.map((row: any) => {
                        let payload: any = {};
                        try {
                            payload = JSON.parse(row.payload);
                        } catch (e) { }

                        return {
                            id: row.id,
                            ...row,
                            ...payload,
                            timestamp: row.server_timestamp || row.timestamp
                        };
                    });
                    this.zone.run(() => observer.next(msgs));
                } catch (err) {
                    this.logger.error('[ChatService] getStarredMessages Local DB Error', err);
                }
            };

            loadStarred();
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
