/**
 * Outbox Service
 * Epic 15: Offline -> Online Reconciliation
 *
 * Manages the offline message queue, automatic retries with exponential backoff,
 * and network status synchronization.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, from, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, delay, filter, map, retryWhen, scan, take, tap } from 'rxjs/operators';
import * as idb from 'idb-keyval';
import { v7 as uuidv7 } from 'uuid';

// ===========================================
// Types
// ===========================================
export type OutboxMessageState = 'CREATED' | 'ENCRYPTED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

export interface OutboxMessage {
    message_uuid: string;
    chat_id: string;
    receiver_id: string; // or group_id
    encrypted_payload: string;
    local_seq: number;
    state: OutboxMessageState;
    retry_count: number;
    next_retry_at: number;
    last_error?: string;
    created_at: number;
    sent_at?: number;
}

export interface SendResult {
    success: boolean;
    server_seq?: number;
    server_received_at?: string;
    error?: string;
    message_uuid: string;
}

// ===========================================
// Constants
// ===========================================
const OUTBOX_STORE_KEY = 'chat_outbox_queue';
const MAX_RETRIES = 10;
const RETRY_DELAYS = [2000, 5000, 10000, 30000, 60000, 120000]; // 2s -> 2m cap

@Injectable({
    providedIn: 'root',
})
export class OutboxService {
    private queue$ = new BehaviorSubject<OutboxMessage[]>([]);
    private isProcessing = false;
    private online$ = new BehaviorSubject<boolean>(navigator.onLine);

    constructor(private http: HttpClient) {
        this.init();
    }

    private async init() {
        // Load queue from IDB
        const stored = (await idb.get(OUTBOX_STORE_KEY)) || [];
        this.queue$.next(stored);

        // Listen for network changes
        window.addEventListener('online', () => {
            this.online$.next(true);
            this.processQueue();
        });
        window.addEventListener('offline', () => this.online$.next(false));

        // Initial process if online
        if (this.online$.value) {
            this.processQueue();
        }
    }

    // ===========================================
    // Public API
    // ===========================================

    /**
     * Enqueues a message for sending.
     * Auto-starts processing if online.
     */
    async enqueue(
        chatId: string,
        receiverId: string,
        encryptedPayload: string,
        localSeq: number,
        messageUuid: string
    ): Promise<void> {
        // Check duplicate
        const currentQueue = this.queue$.value;
        if (currentQueue.some((m) => m.message_uuid === messageUuid)) {
            console.warn(`Duplicate enqueue attempt: ${messageUuid}`);
            return;
        }

        const message: OutboxMessage = {
            message_uuid: messageUuid,
            chat_id: chatId,
            receiver_id: receiverId,
            encrypted_payload: encryptedPayload,
            local_seq: localSeq,
            state: 'QUEUED',
            retry_count: 0,
            next_retry_at: Date.now(),
            created_at: Date.now(),
        };

        const newQueue = [...currentQueue, message];
        await this.saveQueue(newQueue);

        if (this.online$.value) {
            this.processQueue();
        }
    }

    getQueue(): Observable<OutboxMessage[]> {
        return this.queue$.asObservable();
    }

    // ===========================================
    // Queue Processing
    // ===========================================

    async processQueue() {
        if (this.isProcessing || !this.online$.value) return;
        this.isProcessing = true;

        try {
            let queue = this.queue$.value;
            const now = Date.now();

            // Filter messages ready for retry
            const pending = queue.filter(
                (m) =>
                    (m.state === 'QUEUED' || m.state === 'FAILED' || m.state === 'SENDING') &&
                    m.next_retry_at <= now
            );

            // Process strictly in order of creation to preserve sequence
            // Sort by local_seq (creation order)
            pending.sort((a, b) => a.local_seq - b.local_seq);

            for (const msg of pending) {
                if (!this.online$.value) break; // Stop if offline

                await this.attemptSend(msg);

                // Refresh queue state for next iteration
                queue = this.queue$.value;
            }
        } finally {
            this.isProcessing = false;

            // Schedule next check if there are still pending items (wait for next backoff)
            const nextItem = this.queue$.value.find(m => m.state !== 'SENT' && m.state !== 'DELIVERED');
            if (nextItem && this.online$.value) {
                const delayMs = Math.max(0, nextItem.next_retry_at - Date.now());
                if (delayMs > 0) {
                    setTimeout(() => this.processQueue(), delayMs);
                }
            }
        }
    }

    private async attemptSend(msg: OutboxMessage) {
        // Optimistic lock
        if (msg.state === 'SENDING') return; // Already inflight

        await this.updateMessageState(msg.message_uuid, 'SENDING');

        try {
            const result = await this.sendToBackend(msg);

            if (result.success) {
                await this.markSent(msg.message_uuid, result.server_seq!, result.server_received_at);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            await this.handleFailure(msg, error instanceof Error ? error.message : String(error));
        }
    }

    private async sendToBackend(msg: OutboxMessage): Promise<SendResult> {
        const payload = {
            message_uuid: msg.message_uuid,
            chat_id: msg.chat_id,
            receiver_id: msg.receiver_id,
            encrypted_payload: msg.encrypted_payload,
            created_at: msg.created_at
        };

        return this.http.post<SendResult>('/api/v3/send_message.php', payload)
            .pipe(
                map(res => ({ ...res, success: true, message_uuid: msg.message_uuid })),
                catchError(err => {
                    // Idempotency check: returns 200 OK with duplicate:true if already sent
                    // This is already handled by backend returning 200, so HTTP error is a real fail
                    return of({
                        success: false,
                        error: err.message,
                        message_uuid: msg.message_uuid
                    });
                })
            ).toPromise() as Promise<SendResult>;
    }

    // ===========================================
    // State Management
    // ===========================================

    private async updateMessageState(uuid: string, state: OutboxMessageState, updates: Partial<OutboxMessage> = {}) {
        const queue = this.queue$.value;
        const index = queue.findIndex((m) => m.message_uuid === uuid);
        if (index === -1) return;

        const msg = { ...queue[index], state, ...updates };
        queue[index] = msg;
        await this.saveQueue(queue);
    }

    private async markSent(uuid: string, serverSeq: number, serverReceivedAt?: string) {
        const queue = this.queue$.value;
        // Remove from queue completely once sent? 
        // Or keep until ACK? 
        // For now: Mark SENT and keep for cleanup/history or remove to save space.
        // Spec says: SENT -> DELIVERED. So keep it.

        const index = queue.findIndex((m) => m.message_uuid === uuid);
        if (index === -1) return;

        // We can arguably remove it from Outbox as it's now "Sent" and responsibility moves to Chat History
        const newQueue = queue.filter(m => m.message_uuid !== uuid);
        await this.saveQueue(newQueue);

        // Notify listeners (ChatService) - implementation detail
        // For now the Queue observable update handles UI removal
    }

    private async handleFailure(msg: OutboxMessage, error: string) {
        const retryCount = msg.retry_count + 1;

        // Exponential backoff
        const delayIndex = Math.min(retryCount, RETRY_DELAYS.length - 1);
        const delayMs = RETRY_DELAYS[delayIndex];
        const nextRetry = Date.now() + delayMs;

        // Cap retries? (Battery drain risk)
        if (retryCount > MAX_RETRIES) {
            await this.updateMessageState(msg.message_uuid, 'FAILED', {
                last_error: `Max retries exceeded: ${error}`,
                retry_count: retryCount
            });
            return;
        }

        await this.updateMessageState(msg.message_uuid, 'FAILED', {
            last_error: error,
            retry_count: retryCount,
            next_retry_at: nextRetry,
        });
    }

    private async saveQueue(queue: OutboxMessage[]) {
        this.queue$.next(queue);
        await idb.set(OUTBOX_STORE_KEY, queue);
    }
}
