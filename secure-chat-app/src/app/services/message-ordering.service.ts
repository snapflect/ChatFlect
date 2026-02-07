/**
 * Message Ordering Service
 * Epic 13 + Epic 15 Update
 * 
 * Handles sorting of mixed "Confirmed" (Server) and "Optimistic" (Local) messages.
 */
import { Injectable } from '@angular/core';

export interface OrderedMessage {
    id: string;
    server_seq: number | null;
    local_seq: number;
    timestamp: number;
    [key: string]: any;
}

@Injectable({
    providedIn: 'root'
})
export class MessageOrderingService {
    private localSeqCounters = new Map<string, number>();

    constructor() { }

    getNextLocalSeq(chatId: string): number {
        const current = this.localSeqCounters.get(chatId) || 0;
        const next = current + 1;
        this.localSeqCounters.set(chatId, next);
        return next;
    }

    sortMessages(messages: OrderedMessage[]): OrderedMessage[] {
        return [...messages].sort((a, b) => {
            // 1. Both have server_seq: Compare server_seq
            if (a.server_seq !== null && b.server_seq !== null) {
                return a.server_seq - b.server_seq;
            }

            // 2. One has server_seq, one is pending
            // Confirmed messages usually come "before" pending, 
            // BUT if an old pending message is stuck, it should likely stay at bottom or 
            // strictly follow time/local_seq?
            // Spec says: Pending always shown AFTER last confirmed message (?)
            // Or correct slot. Let's stick to TIME fallback if mixed, 
            // or put all pending at bottom.
            // Safety: Put pending at bottom for now logic
            if (a.server_seq !== null && b.server_seq === null) return -1;
            if (a.server_seq === null && b.server_seq !== null) return 1;

            // 3. Both pending: Compare local_seq
            if (a.server_seq === null && b.server_seq === null) {
                return a.local_seq - b.local_seq;
            }

            return 0;
        });
    }
}
