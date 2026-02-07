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
import { Observable, BehaviorSubject, Subject, combineLatest } from 'rxjs'; // Fix: added combineLatest
import { shareReplay, map } from 'rxjs/operators'; // Fix: added map
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
import { OutboxService } from './outbox.service'; // NEW
import { MessageOrderingService } from './message-ordering.service'; // Epic 13
import { v7 as uuidv7 } from 'uuid'; // Epic 12

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
        private outbox: OutboxService, // NEW
        private ordering: MessageOrderingService // Epic 13
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

        const myId = this.auth.getCurrentUserId();
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
        const encrypted = await this.signalService.encryptMessage(receiverId, payloadStr);

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

    getMessagesStream(chatId: string): Observable<any[]> {
        if (this.messageStreams.has(chatId)) {
            return this.messageStreams.get(chatId)!;
        }

        // 1. Firestore Stream (Confirmed Messages)
        const firestoreStream = this.getSimpleMessagesStream(chatId);

        // 2. Outbox Stream (Pending Messages for this chat)
        const outboxStream = this.outbox.getQueue().pipe(
            map(queue => queue
                .filter(m => m.chat_id === chatId)
                .map(m => ({
                    id: m.message_uuid,
                    senderId: this.auth.getCurrentUserId(), // My message
                    // Decrypt internal payload logic would go here if we stored plaintext, 
                    // but we store encrypted. For UI, we might need to store plaintext 
                    // or decrypt it back. Ideally store separate UI-friendly version or re-decrypt?
                    // For MVP optimization: Outbox *could* store plaintext for UI, but Security says NO.
                    // Solution: Signal Service local decrypt or cache.
                    // Let's assume we can 'peek' or store a temp UI cache separate from secure outbox.
                    // But for strict security: Store encrypted, decrypt on load.
                    content: '[Pending...]', // Placeholder until we fix UI-side decryption of own outbox
                    type: 'text',
                    timestamp: m.created_at,
                    server_seq: null, // Pending
                    local_seq: m.local_seq,
                    status: m.state // 'QUEUED', 'SENDING', 'FAILED'
                }))
            )
        );

        // 3. Combine and Sort (Epic 13)
        const combined = combineLatest([firestoreStream, outboxStream]).pipe(
            map(([confirmed, pending]) => {
                // Merge
                const all = [...confirmed, ...pending];

                // Deduplicate (Epic 12) - Outbox item might exist in confirmed if ACK is slow
                // Prefer Confirmed if UUID matches
                const unique = new Map();
                for (const m of all) {
                    const uuid = m.message_uuid || m.id; // standardize ID
                    if (!unique.has(uuid) || (m.server_seq !== null && unique.get(uuid).server_seq === null)) {
                        unique.set(uuid, m);
                    }
                }

                // Sort (Epic 13)
                // 1. Server Seq
                // 2. Local Seq (if Server Seq null)
                return this.ordering.sortMessages(Array.from(unique.values()));
            }),
            shareReplay(1)
        );

        this.messageStreams.set(chatId, combined);
        return combined;
    }

    // Helper for Firestore basics
    private getSimpleMessagesStream(chatId: string): Observable<any[]> {
        // [Existing Firestore Query Logic]
        // ... (truncated for brevity, assume calling internal fsOnSnapshot logic)
        // returning observable of decrypted messages

        // This is a placeholder for the existing complex listener logic
        // In real code, we wrap the existing listener 
        return new Observable(observer => {
            const ref = collection(this.db, `chats/${chatId}/messages`);
            const q = query(ref, orderBy('server_seq', 'asc'), limit(50));
            // ... implementation details ...
            onSnapshot(q, (snap) => {
                const msgs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                // Decrypt loop...
                observer.next(msgs);
            });
        });
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
