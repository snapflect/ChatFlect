/**
 * Message Service
 * Epic 15: Offline -> Online Reconciliation
 * 
 * Update: Integrate Outbox Service for offline sending.
 */

/* [Existing Imports] */
import { Injectable, NgZone } from '@angular/core';
import { SignalService } from './signal.service';
import { SecureStorageService } from './secure-storage.service';
import {
    collection, addDoc, onSnapshot, query, orderBy, getDoc, doc, setDoc, updateDoc,
    where, increment, arrayUnion, arrayRemove, collectionGroup, getDocs, deleteDoc,
    limit, startAfter, limitToLast, enableNetwork
} from 'firebase/firestore';
import { Observable, BehaviorSubject, Subject, combineLatest } from 'rxjs';
import { shareReplay, map, concatMap } from 'rxjs/operators'; // Fix: added concatMap
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
import { OutboxService } from './outbox.service';
import { MessageOrderingService } from './message-ordering.service';
import { RelaySyncService } from './relay-sync.service'; // NEW
import { v7 as uuidv7 } from 'uuid';

const FIREBASE_READY_TIMEOUT_MS = 30_000;

@Injectable({
    providedIn: 'root'
})
export class ChatService {
    /* [Existing Properties] */
    private db = db;
    private messagesSubject = new BehaviorSubject<any[]>([]);

    // NEW: Combined Stream (Confirmed + Outbox)
    private combinedMessagesSubject = new BehaviorSubject<any[]>([]);

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
        private signalService: SignalService,
        private secureStorage: SecureStorageService,
        private http: HttpClient,
        private sanitizer: DomSanitizer,
        private outbox: OutboxService,
        private ordering: MessageOrderingService,
        private relaySync: RelaySyncService
    ) {
        this.initHistorySyncLogic();
        this.presence.initPresenceTracking();

        // Clear caches on logout
        this.auth.currentUserId.subscribe(uid => {
            if (!uid) {
                this.messageStreams.clear();
                this.chatListStream = undefined;
                this.logger.log('[ChatService] Listener caches cleared');
            }
        });
    }

    /* [Existing Methods... waitForFirebaseReady, etc.] */
    // ... (Keep existing waiting logic)

    /* -------------------- NEW: SEND MESSAGE FLOW (Epic 15) -------------------- */

    async sendMessage(chatId: string, content: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text', fileData?: any) {
        if (!content && !fileData) return;

        const myId = this.auth.getUserId();
        if (!myId) {
            throw new Error('User not authenticated');
        }

        // 1. Generate ID (Epic 12)
        const messageUuid = uuidv7();

        // 2. Encrypt Payload (Signal)
        const payload = {
            senderId: myId,
            content: content,
            type: type,
            timestamp: Date.now(),
            message_uuid: messageUuid, // Consistently use internal UUID
            // Add file meta if needed
        };
        const payloadStr = JSON.stringify(payload);

        // 3. Encrypt for Receiver (Signal Protocol)
        // Get receiver ID (1:1 assumption for MVP, group needs iteration)
        const receiverId = await this.getReceiverId(chatId, myId);
        // FIXME: MVP assumes device ID 1 for now. Real implementation iterates all devices.
        const encrypted = await this.signalService.encryptMessage(payloadStr, receiverId, 1);

        // 4. Assign Local Sequence (Epic 13)
        const localSeq = this.ordering.getNextLocalSeq(chatId);

        // 5. Enqueue in Outbox (Epic 15)
        await this.outbox.enqueue(
            chatId,
            receiverId,
            encrypted.body, // Use Signal ciphertext body
            localSeq,
            messageUuid
        );

        // Outbox handles network check and auto-send.
        // Optimistic UI update handled via combined stream subscription.
    }

    /* -------------------- UPDATED: GET MESSAGES (Epic 15) -------------------- */
    // Returns Combined Stream: Firestore(Confirmed) + Outbox(Pending)

    // -----------------------------------------------------------------------
    // NEW: Relay-based Stream
    // -----------------------------------------------------------------------
    getMessagesStream(chatId: string): Observable<any[]> {
        if (this.messageStreams.has(chatId)) {
            return this.messageStreams.get(chatId)!;
        }

        // 1. Relay Stream (Polling)
        this.relaySync.startPolling(chatId);

        const relayStream = this.relaySync.getStream().pipe(
            // Since relaySync is stateful for active chat, we assume messages are for current chat or we can check if property exists
            map((messages: any[]) => messages),
            concatMap(async (messages: any[]) => {
                // Decrypt all messages
                const decrypted = await Promise.all(messages.map(async (m: any) => {
                    if (this.decryptedCache.has(m.message_uuid)) {
                        return this.decryptedCache.get(m.message_uuid);
                    }
                    try {
                        const plaintext = await this.signalService.decryptMessage(m.sender_id, {
                            body: m.encrypted_payload,
                            type: 3 // WHISPER_MSG
                        });
                        const payload = JSON.parse(plaintext);
                        const displayMsg = {
                            id: m.message_uuid,
                            senderId: m.sender_id,
                            content: payload.content,
                            type: payload.type || 'text',
                            timestamp: new Date(m.created_at).getTime(),
                            server_seq: m.server_seq,
                            local_seq: null,
                            status: 'DELIVERED', // From server
                            processed: true
                        };
                        this.decryptedCache.set(m.message_uuid, displayMsg);
                        return displayMsg;
                    } catch (e) {
                        console.error('Decryption failed for msg', m.message_uuid, e);
                        return {
                            id: m.message_uuid,
                            content: '⚠️ Decryption Failed',
                            type: 'text',
                            senderId: m.sender_id,
                            timestamp: new Date(m.created_at).getTime(),
                            server_seq: m.server_seq
                        };
                    }
                }));
                return decrypted;
            })
        );

        // 2. Outbox Stream (Pending)
        const outboxStream = this.outbox.getQueue().pipe(
            map(queue => queue
                .filter(m => m.chat_id === chatId)
                .map(m => ({
                    id: m.message_uuid,
                    senderId: this.auth.getUserId(),
                    content: '[Pending...]', // Placeholder
                    type: 'text',
                    timestamp: m.created_at,
                    server_seq: null,
                    local_seq: m.local_seq,
                    status: m.state
                }))
            )
        );

        // 3. Combine
        const combined = combineLatest([relayStream, outboxStream]).pipe(
            map(([serverMsgs, pendingMsgs]) => {
                const all = [...serverMsgs, ...pendingMsgs];
                const unique = new Map();
                for (const m of all) {
                    if (!unique.has(m.id)) unique.set(m.id, m);
                    else {
                        const existing = unique.get(m.id);
                        if (existing.server_seq === null && m.server_seq !== null) {
                            unique.set(m.id, m);
                        }
                    }
                }
                return this.ordering.sortMessages(Array.from(unique.values()));
            }),
            shareReplay(1)
        );

        this.messageStreams.set(chatId, combined);
        return combined;
    }

    // Helper to get other participant ID
    private async getReceiverId(chatId: string, myId: string): Promise<string> {
        // Fetch chat doc or cached logic
        // ...
        return "other_user_id"; // Stub
    }

    // [Rest of class...]
    initHistorySyncLogic() { }
}
