import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Subscription, Subject } from 'rxjs';
import { auditTime, takeUntil } from 'rxjs/operators';
import { ChatService } from './chat.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class MessageStoreService {
    private messagesSubject = new BehaviorSubject<any[]>([]);
    public messages$ = this.messagesSubject.asObservable();

    private messagesMap = new Map<string, any>();
    private activeChatId: string | null = null;
    private currentUserId: string | null = null;
    private subscription: Subscription | null = null;
    private destroy$ = new Subject<void>();

    constructor(
        private chatService: ChatService,
        private auth: AuthService,
        private logger: LoggingService
    ) {
        this.auth.currentUserId
            .pipe(takeUntil(this.destroy$))
            .subscribe(id => this.currentUserId = id);
    }

    /**
     * Connects the store to a specific chat, initializing the message stream.
     */
    connect(chatId: string) {
        if (this.activeChatId === chatId) return;

        this.disconnect();
        this.activeChatId = chatId;
        this.messagesMap.clear();
        this.messagesSubject.next([]);

        this.subscription = combineLatest([
            this.chatService.getMessages(chatId),
            this.chatService.pendingMessages$
        ]).pipe(
            auditTime(50) // Prevent UI thrashing during bursts
        ).subscribe(([realMsgs, pendingMap]) => {
            const pending = pendingMap[chatId] || [];
            this.mergeMessages(realMsgs, pending);
        });
    }

    /**
     * Disconnects and cleans up subscriptions.
     */
    disconnect() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
        this.activeChatId = null;
        this.messagesMap.clear();
        this.messagesSubject.next([]);
    }

    /**
     * Adds older messages to the store (for lazy loading).
     */
    addOlderMessages(olderMsgs: any[]) {
        if (olderMsgs && olderMsgs.length > 0) {
            olderMsgs.forEach(m => {
                const key = this.getMessageKey(m);
                this.messagesMap.set(key, m);
            });
            this.refreshMessages();
        }
    }

    private mergeMessages(realMsgs: any[], pendingMsgs: any[]) {
        // 1. Update Map with Real Messages
        realMsgs.forEach(m => {
            const key = this.getMessageKey(m);
            this.messagesMap.set(key, m);
        });

        // 2. Prepare Matchers for Deduplication
        const realMsgIndex = realMsgs.map(m => ({
            id: m.id,
            tempId: m.tempId || m.text?.tempId || m.text?._tempId,
            signature: this.createSignature(m)
        }));

        // 3. Filter Pending Messages
        const filteredPending = pendingMsgs.filter(p => {
            const pKey = this.getMessageKey(p);
            if (this.messagesMap.has(pKey)) return false;

            const pTempId = p.id;
            const pSignature = this.createSignature(p);

            // Layer 1: Strict ID Match
            const strictMatch = realMsgIndex.find(r => {
                const rTemp = r.tempId;
                return rTemp == pTempId;
            });
            if (strictMatch) return false;

            // Layer 2: Fuzzy Content Match (Only for current user)
            if (String(p.senderId) === String(this.currentUserId)) {
                if (pSignature && pSignature.length > 5) {
                    const fuzzyMatch = realMsgIndex.find(r => r.signature === pSignature);
                    if (fuzzyMatch) return false;
                }
            }

            return true;
        });

        // 4. Add Verified Pending
        filteredPending.forEach(p => {
            const pKey = this.getMessageKey(p);
            this.messagesMap.set(pKey, p);
        });

        this.refreshMessages();
    }

    private refreshMessages() {
        let allMsgs = Array.from(this.messagesMap.values());

        // Nuclear Deduplication Sweep
        allMsgs = this.removeDuplicatesSweep(allMsgs);

        // Sort: Ascending Timestamp
        allMsgs.sort((a, b) => this.getTimestamp(a) - this.getTimestamp(b));

        // Sliding Window: Prevent infinite memory growth
        const maxMessages = 2000;
        if (allMsgs.length > maxMessages) {
            allMsgs = allMsgs.slice(-maxMessages);
            this.messagesMap.clear();
            allMsgs.forEach(m => {
                const key = this.getMessageKey(m);
                this.messagesMap.set(key, m);
            });
        }

        this.messagesSubject.next(allMsgs);
    }

    private getTimestamp(msg: any): number {
        if (msg.timestamp?.seconds) return msg.timestamp.seconds * 1000;
        if (typeof msg.timestamp === 'number') return msg.timestamp;
        return 0;
    }

    private removeDuplicatesSweep(msgs: any[]): any[] {
        const seenIds = new Set<string>();
        const filtered: any[] = [];

        for (const m of msgs) {
            const key = this.getMessageKey(m);
            if (!seenIds.has(key)) {
                seenIds.add(key);
                filtered.push(m);
            }
        }

        return filtered;
    }

    private getMessageKey(m: any): string {
        const id = String(m.id || m.server_id || '').trim().toUpperCase();
        const sender = String(m.sender_id || m.senderId || 'SYSTEM').trim().toUpperCase();
        return `${id}_${sender}`;
    }

    private createSignature(msg: any): string {
        const t = msg.text || {};
        const type = msg.type;
        if (type === 'document') {
            if (t.name && t.size) return `doc_${this.activeChatId}_${t.name}_${t.size}`;
        } else if (type === 'image' || type === 'video') {
            // Strengthened signature: Incorporate URL/TempID to avoid collisions
            const identifier = t.url || t.tempId || t._tempId || 'no_url';
            return `${type}_${this.activeChatId}_${identifier}_${t.size || 0}`;
        }
        return '';
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.disconnect();
    }
}
