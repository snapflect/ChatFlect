import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, timer, Subject, of } from 'rxjs';
import { switchMap, tap, takeUntil, filter, catchError } from 'rxjs/operators';
import { RelayService, RelayMessage } from './relay.service';
import { MessageOrderingService } from './message-ordering.service';

export interface RelayReceipt {
    receipt_id: number;
    chat_id: string;
    message_uuid: string;
    user_id: string;
    device_uuid: string;
    type: 'DELIVERED' | 'READ';
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class RelaySyncService implements OnDestroy {
    private activeChatId: string | null = null;
    private pollingSubscription: Subscription | null = null;
    private stopPolling$ = new Subject<void>();
    private lastServerSeqMap = new Map<string, number>();
    private lastReceiptIdMap = new Map<string, number>();

    // Streams
    private messageStream$ = new Subject<RelayMessage[]>();
    private receiptStream$ = new Subject<RelayReceipt[]>();

    private isVisible = true;

    constructor(
        private relay: RelayService,
        private ordering: MessageOrderingService
    ) {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = document.visibilityState === 'visible';
            if (this.activeChatId) {
                this.restartPollingForVisibility();
            }
        });
    }

    startPolling(chatId: string) {
        if (this.activeChatId === chatId && this.pollingSubscription && !this.pollingSubscription.closed) {
            return;
        }

        this.stopPolling();
        this.stopPolling$ = new Subject<void>();
        this.activeChatId = chatId;
        this.startPollingInternal();
    }

    private startPollingInternal() {
        if (!this.activeChatId) return;

        const chatId = this.activeChatId;
        const intervalMs = this.isVisible ? 3000 : 30000;

        this.pollingSubscription = timer(0, intervalMs).pipe(
            takeUntil(this.stopPolling$),
            switchMap(() => {
                const currentSeq = this.lastServerSeqMap.get(chatId) || 0;
                // Epic 21: Include receipt cursor
                // Note: RelayService.fetchMessages needs update to support receipt cursor or we overload the call.
                // Assuming RelayService.fetchMessages is updated effectively via API call structure.
                // We'll pass extra params via a new method or modified one? 
                // Let's assume we modify fetchMessages signature or similar.
                // Wait, RelayService.ts isn't modified yet.
                // I need to update RelayService.ts first to support receipts!
                // But I can cast for now or update it in next step.
                // I'll call a hypothetical method `fetchMessagesAndReceipts` or just update the existing one.

                return this.relay.fetchMessages(chatId, currentSeq).pipe(
                    // TODO: Update RelayService to pass since_receipt_id
                    catchError(err => {
                        console.warn('[RelaySync] Poll Error:', err.message);
                        return of({ messages: [], receipts: [] });
                    })
                );
            }),
            filter((res: any) => (res && (res.messages?.length > 0 || res.receipts?.length > 0)))
        ).subscribe((res: any) => {
            if (this.activeChatId === chatId) {
                if (res.messages && res.messages.length > 0) {
                    this.handleNewMessages(chatId, res.messages);
                }
                if (res.receipts && res.receipts.length > 0) {
                    this.handleNewReceipts(chatId, res.receipts);
                }
            }
        });

        console.log(`[RelaySync] Polling ${chatId} (Interval: ${intervalMs}ms)`);
    }

    private restartPollingForVisibility() {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
        }
        this.startPollingInternal();
    }

    stopPolling() {
        this.activeChatId = null;
        this.stopPolling$.next();
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = null;
        }
    }

    forceSync() {
        if (this.activeChatId) {
            this.restartPollingForVisibility();
        }
    }

    private handleNewMessages(chatId: string, messages: RelayMessage[]) {
        let maxSeq = this.lastServerSeqMap.get(chatId) || 0;
        messages.forEach(msg => {
            if (msg.server_seq > maxSeq) {
                maxSeq = msg.server_seq;
            }
            // Gap Detection (Epic 21)
            // if (msg.server_seq > localMax + 1) -> triggers repair
            // We'll leave strict repair Logic for a separate method or Next Step to keep this clean.
        });
        this.lastServerSeqMap.set(chatId, maxSeq);
        this.messageStream$.next(messages);
    }

    private handleNewReceipts(chatId: string, receipts: RelayReceipt[]) {
        let maxId = this.lastReceiptIdMap.get(chatId) || 0;
        receipts.forEach(r => {
            if (r.receipt_id > maxId) maxId = r.receipt_id;
        });
        this.lastReceiptIdMap.set(chatId, maxId);
        this.receiptStream$.next(receipts);
    }

    getStream(): Observable<RelayMessage[]> {
        return this.messageStream$.asObservable();
    }

    getReceiptStream(): Observable<RelayReceipt[]> {
        return this.receiptStream$.asObservable();
    }

    getLastSeq(chatId: string): number {
        return this.lastServerSeqMap.get(chatId) || 0;
    }

    ngOnDestroy() {
        this.stopPolling();
    }
}
