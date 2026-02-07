/**
 * Message Ordering Service
 * Epic 13: Ordering Guarantees (Logical Clock Engine)
 *
 * Ensures all devices see messages in the same deterministic order.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// ===========================================
// Message with Ordering Fields
// ===========================================
export interface OrderedMessage {
    id: string;
    serverSeq: number | null;  // Server-assigned (final authority)
    localSeq: number;          // Client-assigned (optimistic)
    timestamp: number;         // Wall clock fallback
    content: any;
}

// ===========================================
// Local Sequence State
// ===========================================
interface ChatSequenceState {
    chatId: string;
    lastLocalSeq: number;
    lastServerSeq: number;
}

@Injectable({
    providedIn: 'root',
})
export class MessageOrderingService {
    // Per-chat sequence state
    private sequenceStates = new Map<string, ChatSequenceState>();

    constructor() { }

    // ===========================================
    // Get Next Local Sequence
    // ===========================================
    getNextLocalSeq(chatId: string): number {
        let state = this.sequenceStates.get(chatId);

        if (!state) {
            state = { chatId, lastLocalSeq: 0, lastServerSeq: 0 };
            this.sequenceStates.set(chatId, state);
        }

        state.lastLocalSeq++;
        return state.lastLocalSeq;
    }

    // ===========================================
    // Update with Server Sequence
    // ===========================================
    updateServerSeq(chatId: string, serverSeq: number): void {
        let state = this.sequenceStates.get(chatId);

        if (!state) {
            state = { chatId, lastLocalSeq: serverSeq, lastServerSeq: serverSeq };
            this.sequenceStates.set(chatId, state);
        } else {
            state.lastServerSeq = Math.max(state.lastServerSeq, serverSeq);
            // Sync local to prevent sequence gaps
            state.lastLocalSeq = Math.max(state.lastLocalSeq, serverSeq);
        }
    }

    // ===========================================
    // Sort Messages by Server Order
    // ===========================================
    sortMessages(messages: OrderedMessage[]): OrderedMessage[] {
        return [...messages].sort((a, b) => {
            // Primary: server_seq (if available)
            if (a.serverSeq !== null && b.serverSeq !== null) {
                return a.serverSeq - b.serverSeq;
            }

            // If only one has server_seq, it comes first (older)
            if (a.serverSeq !== null) return -1;
            if (b.serverSeq !== null) return 1;

            // Secondary: local_seq (for pending messages)
            if (a.localSeq !== b.localSeq) {
                return a.localSeq - b.localSeq;
            }

            // Tertiary: timestamp (last resort)
            return a.timestamp - b.timestamp;
        });
    }

    // ===========================================
    // Reconcile Server Order
    // ===========================================
    reconcileWithServerOrder(
        localMessages: OrderedMessage[],
        serverMessages: OrderedMessage[]
    ): { reordered: boolean; messages: OrderedMessage[] } {
        const serverMap = new Map<string, OrderedMessage>();
        serverMessages.forEach((m) => serverMap.set(m.id, m));

        let reordered = false;

        // Update local messages with server sequences
        const reconciled = localMessages.map((local) => {
            const server = serverMap.get(local.id);
            if (server && server.serverSeq !== null) {
                if (local.serverSeq !== server.serverSeq) {
                    reordered = true;
                }
                return { ...local, serverSeq: server.serverSeq };
            }
            return local;
        });

        // Sort by server order
        const sorted = this.sortMessages(reconciled);

        return { reordered, messages: sorted };
    }

    // ===========================================
    // Get Current State
    // ===========================================
    getSequenceState(chatId: string): ChatSequenceState | null {
        return this.sequenceStates.get(chatId) ?? null;
    }

    // ===========================================
    // Initialize from Loaded Messages
    // ===========================================
    initializeFromMessages(chatId: string, messages: OrderedMessage[]): void {
        let maxServerSeq = 0;
        let maxLocalSeq = 0;

        for (const msg of messages) {
            if (msg.serverSeq !== null && msg.serverSeq > maxServerSeq) {
                maxServerSeq = msg.serverSeq;
            }
            if (msg.localSeq > maxLocalSeq) {
                maxLocalSeq = msg.localSeq;
            }
        }

        this.sequenceStates.set(chatId, {
            chatId,
            lastLocalSeq: Math.max(maxServerSeq, maxLocalSeq),
            lastServerSeq: maxServerSeq,
        });
    }

    // ===========================================
    // Detect Gaps in Sequence
    // ===========================================
    detectGaps(chatId: string, messages: OrderedMessage[]): number[] {
        const gaps: number[] = [];
        const seqs = messages
            .filter((m) => m.serverSeq !== null)
            .map((m) => m.serverSeq!)
            .sort((a, b) => a - b);

        for (let i = 1; i < seqs.length; i++) {
            const expected = seqs[i - 1] + 1;
            if (seqs[i] !== expected) {
                // Gap detected
                for (let g = expected; g < seqs[i]; g++) {
                    gaps.push(g);
                }
            }
        }

        return gaps;
    }
}
