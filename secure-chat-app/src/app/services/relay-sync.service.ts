import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, timer, Subject } from 'rxjs';
import { switchMap, tap, takeUntil, filter, catchError } from 'rxjs/operators';
import { RelayService, RelayMessage } from './relay.service';
import { MessageOrderingService } from './message-ordering.service';

@Injectable({
    providedIn: 'root'
})
export class RelaySyncService implements OnDestroy {
    private activeChatId: string | null = null;
    private pollingSubscription: Subscription | null = null;
    private stopPolling$ = new Subject<void>();
    private lastServerSeqMap = new Map<string, number>();

    // Stream of incoming messages (merged from polling)
    private messageStream$ = new Subject<RelayMessage[]>();

    constructor(
        private relay: RelayService,
        private ordering: MessageOrderingService
    ) { }

    /**
     * Starts polling for a specific chat.
     * Should be called when entering a chat view.
     */
    startPolling(chatId: string) {
        if (this.activeChatId === chatId && this.pollingSubscription) {
            return; // Already polling this chat
        }

        this.stopPolling(); // Stop previous
        this.activeChatId = chatId;

        // Initial fetch or resume from last known seq
        const sinceSeq = this.lastServerSeqMap.get(chatId) || 0;

        // Polling Strategy: Short Polling (3s)
        // Adaptive strategy (e.g. backoff) can be implemented here later.
        this.pollingSubscription = timer(0, 3000).pipe(
            takeUntil(this.stopPolling$),
            switchMap(() => {
                const currentSeq = this.lastServerSeqMap.get(chatId!) || 0;
                return this.relay.fetchMessages(chatId!, currentSeq).pipe(
                    catchError(err => {
                        console.error('Relay Sync Error:', err);
                        return []; // Ignore error to keep polling alive? Or use retry logic
                    })
                );
            }),
            filter((res: any) => res && res.messages && res.messages.length > 0)
        ).subscribe((res: any) => {
            this.handleNewMessages(chatId!, res.messages);
        });

        console.log(`[RelaySync] Started polling for chat: ${chatId} since ${sinceSeq}`);
    }

    /**
     * Stops polling.
     * Should be called when leaving a chat view.
     */
    stopPolling() {
        this.activeChatId = null;
        this.stopPolling$.next();
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = null;
        }
    }

    private handleNewMessages(chatId: string, messages: RelayMessage[]) {
        let maxSeq = this.lastServerSeqMap.get(chatId) || 0;

        messages.forEach(msg => {
            if (msg.server_seq > maxSeq) {
                maxSeq = msg.server_seq;
            }
        });

        // Update local tracking
        this.lastServerSeqMap.set(chatId, maxSeq); // In-memory ONLY for MVP. Should persist to IDB/SQLite ideally.

        // Emit to stream
        this.messageStream$.next(messages);
    }

    /**
     * Returns the stream of new messages arriving via Relay.
     * ChatService will combine this with Outbox pending messages.
     */
    getStream(): Observable<RelayMessage[]> {
        return this.messageStream$.asObservable();
    }

    /**
     * Determine the initial state (needed if we want to sync old messages on load)
     * For MVP, startPolling handles it.
     */
    getLastSeq(chatId: string): number {
        return this.lastServerSeqMap.get(chatId) || 0;
    }

    ngOnDestroy() {
        this.stopPolling();
    }
}
