import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, timer, Subject, of } from 'rxjs';
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

    private isVisible = true;

    constructor(
        private relay: RelayService,
        private ordering: MessageOrderingService
    ) {
        // Optimize: Listen to visibility changes
        document.addEventListener('visibilitychange', () => {
            this.isVisible = document.visibilityState === 'visible';
            if (this.activeChatId) {
                // Restart polling to adapt interval (3s <-> 30s)
                this.restartPollingForVisibility();
            }
        });
    }

    /**
     * Starts polling for a specific chat.
     * Should be called when entering a chat view.
     */
    startPolling(chatId: string) {
        if (this.activeChatId === chatId && this.pollingSubscription && !this.pollingSubscription.closed) {
            return; // Already polling this chat
        }

        this.stopPolling(); // Stop previous

        // Fix 1: Reset stop signal for new session
        this.stopPolling$ = new Subject<void>();

        this.activeChatId = chatId;
        this.startPollingInternal();
    }

    private startPollingInternal() {
        if (!this.activeChatId) return;

        const chatId = this.activeChatId;
        const intervalMs = this.isVisible ? 3000 : 30000; // 3s vs 30s

        this.pollingSubscription = timer(0, intervalMs).pipe(
            takeUntil(this.stopPolling$),
            switchMap(() => {
                // Failover Check: If not visible, double check if we really should poll? 
                // User requirement: "reduce background polling frequency" -> 30s is good.

                const currentSeq = this.lastServerSeqMap.get(chatId) || 0;
                return this.relay.fetchMessages(chatId, currentSeq).pipe(
                    catchError(err => {
                        console.warn('[RelaySync] Poll Error:', err.message);
                        // Fix 2: Return valid Observable structure
                        return of({ messages: [] });
                    })
                );
            }),
            filter((res: any) => res && res.messages && res.messages.length > 0)
        ).subscribe((res: any) => {
            if (this.activeChatId === chatId) {
                this.handleNewMessages(chatId, res.messages);
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
