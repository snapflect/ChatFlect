/**
 * Message State Machine Service
 * Epic 11: Messaging State Machine Core
 *
 * Provides deterministic message lifecycle management with strict state transitions.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

// ===========================================
// Message States
// ===========================================
export enum MessageState {
    CREATED = 0,
    ENCRYPTED = 1,
    QUEUED = 2,
    SENT = 3,
    DELIVERED = 4,
    READ = 5,
    FAILED = 6,
    REPAIRED = 7,
}

// ===========================================
// State Transition Events
// ===========================================
export interface StateTransitionEvent {
    messageId: string;
    fromState: MessageState;
    toState: MessageState;
    stateVersion: number;
    timestamp: Date;
    error?: string;
}

// ===========================================
// Message State Record
// ===========================================
export interface MessageStateRecord {
    messageId: string;
    state: MessageState;
    stateVersion: number;
    lastTransitionAt: Date;
    lastError: string | null;
    retryCount: number;
}

// ===========================================
// Allowed Transitions
// ===========================================
const ALLOWED_TRANSITIONS: Record<MessageState, MessageState[]> = {
    [MessageState.CREATED]: [MessageState.ENCRYPTED, MessageState.FAILED],
    [MessageState.ENCRYPTED]: [MessageState.QUEUED, MessageState.FAILED],
    [MessageState.QUEUED]: [MessageState.SENT, MessageState.FAILED, MessageState.QUEUED],
    [MessageState.SENT]: [MessageState.DELIVERED, MessageState.FAILED],
    [MessageState.DELIVERED]: [MessageState.READ],
    [MessageState.READ]: [], // Terminal state
    [MessageState.FAILED]: [MessageState.REPAIRED, MessageState.FAILED],
    [MessageState.REPAIRED]: [MessageState.SENT],
};

// ===========================================
// State Names for Logging
// ===========================================
export const STATE_NAMES: Record<MessageState, string> = {
    [MessageState.CREATED]: 'CREATED',
    [MessageState.ENCRYPTED]: 'ENCRYPTED',
    [MessageState.QUEUED]: 'QUEUED',
    [MessageState.SENT]: 'SENT',
    [MessageState.DELIVERED]: 'DELIVERED',
    [MessageState.READ]: 'READ',
    [MessageState.FAILED]: 'FAILED',
    [MessageState.REPAIRED]: 'REPAIRED',
};

@Injectable({
    providedIn: 'root',
})
export class MessageStateMachineService {
    // In-memory state cache
    private stateCache = new Map<string, MessageStateRecord>();

    // Pending transition queue for crash recovery
    private pendingTransitions: StateTransitionEvent[] = [];

    // Observable for state changes
    private stateChangeSubject = new Subject<StateTransitionEvent>();
    public stateChange$: Observable<StateTransitionEvent> = this.stateChangeSubject.asObservable();

    // Invalid transition events
    private invalidTransitionSubject = new Subject<StateTransitionEvent>();
    public invalidTransition$: Observable<StateTransitionEvent> = this.invalidTransitionSubject.asObservable();

    constructor() {
        // Subscribe to invalid transitions for logging
        this.invalidTransition$.subscribe((event) => {
            console.error('INVALID_STATE_TRANSITION', {
                messageId: event.messageId,
                fromState: STATE_NAMES[event.fromState],
                toState: STATE_NAMES[event.toState],
                error: event.error,
                timestamp: event.timestamp.toISOString(),
            });
        });
    }

    // ===========================================
    // State Transition Guard
    // ===========================================
    canTransition(from: MessageState, to: MessageState): boolean {
        return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
    }

    // ===========================================
    // Get Current State
    // ===========================================
    getState(messageId: string): MessageStateRecord | null {
        return this.stateCache.get(messageId) ?? null;
    }

    // ===========================================
    // Initialize Message State
    // ===========================================
    initializeState(messageId: string): MessageStateRecord {
        const record: MessageStateRecord = {
            messageId,
            state: MessageState.CREATED,
            stateVersion: 1,
            lastTransitionAt: new Date(),
            lastError: null,
            retryCount: 0,
        };

        this.stateCache.set(messageId, record);

        // Log initialization
        console.log('MESSAGE_STATE_INIT', {
            messageId,
            state: STATE_NAMES[MessageState.CREATED],
            stateVersion: 1,
            timestamp: record.lastTransitionAt.toISOString(),
        });

        return record;
    }

    // ===========================================
    // Apply State Transition
    // ===========================================
    applyTransition(
        messageId: string,
        toState: MessageState,
        error?: string
    ): { success: boolean; record?: MessageStateRecord; error?: string } {
        const currentRecord = this.stateCache.get(messageId);

        if (!currentRecord) {
            return {
                success: false,
                error: `Message ${messageId} not found in state cache`,
            };
        }

        const fromState = currentRecord.state;

        // Check if transition is allowed
        if (!this.canTransition(fromState, toState)) {
            const event: StateTransitionEvent = {
                messageId,
                fromState,
                toState,
                stateVersion: currentRecord.stateVersion,
                timestamp: new Date(),
                error: `Direct transition from ${STATE_NAMES[fromState]} to ${STATE_NAMES[toState]} not allowed`,
            };

            this.invalidTransitionSubject.next(event);

            return {
                success: false,
                error: event.error,
            };
        }

        // Apply transition
        const newRecord: MessageStateRecord = {
            ...currentRecord,
            state: toState,
            stateVersion: currentRecord.stateVersion + 1,
            lastTransitionAt: new Date(),
            lastError: toState === MessageState.FAILED ? (error ?? 'Unknown error') : null,
            retryCount:
                toState === MessageState.FAILED ? currentRecord.retryCount + 1 : currentRecord.retryCount,
        };

        this.stateCache.set(messageId, newRecord);

        // Emit state change event
        const event: StateTransitionEvent = {
            messageId,
            fromState,
            toState,
            stateVersion: newRecord.stateVersion,
            timestamp: newRecord.lastTransitionAt,
        };

        this.stateChangeSubject.next(event);

        // Log transition
        console.log('MESSAGE_STATE_TRANSITION', {
            messageId,
            fromState: STATE_NAMES[fromState],
            toState: STATE_NAMES[toState],
            stateVersion: newRecord.stateVersion,
            timestamp: newRecord.lastTransitionAt.toISOString(),
        });

        return { success: true, record: newRecord };
    }

    // ===========================================
    // Crash Recovery
    // ===========================================
    async recoverPendingMessages(
        loadFromDb: () => Promise<MessageStateRecord[]>
    ): Promise<number> {
        try {
            const pendingRecords = await loadFromDb();

            let recoveredCount = 0;

            for (const record of pendingRecords) {
                // Only recover messages in intermediate states
                if (
                    record.state === MessageState.ENCRYPTED ||
                    record.state === MessageState.QUEUED
                ) {
                    this.stateCache.set(record.messageId, record);

                    // Add to pending queue for replay
                    this.pendingTransitions.push({
                        messageId: record.messageId,
                        fromState: record.state,
                        toState: record.state, // Will be processed by caller
                        stateVersion: record.stateVersion,
                        timestamp: new Date(),
                    });

                    recoveredCount++;
                }
            }

            console.log('MESSAGE_STATE_RECOVERY', {
                recoveredCount,
                pendingStates: pendingRecords.length,
                timestamp: new Date().toISOString(),
            });

            return recoveredCount;
        } catch (err) {
            console.error('MESSAGE_STATE_RECOVERY_ERROR', err);
            return 0;
        }
    }

    // ===========================================
    // Get Pending Transitions for Replay
    // ===========================================
    getPendingTransitions(): StateTransitionEvent[] {
        return [...this.pendingTransitions];
    }

    // ===========================================
    // Clear Pending Transition
    // ===========================================
    clearPendingTransition(messageId: string): void {
        this.pendingTransitions = this.pendingTransitions.filter(
            (t) => t.messageId !== messageId
        );
    }

    // ===========================================
    // Bulk State Load (for cache hydration)
    // ===========================================
    hydrateCache(records: MessageStateRecord[]): void {
        for (const record of records) {
            this.stateCache.set(record.messageId, record);
        }

        console.log('MESSAGE_STATE_CACHE_HYDRATED', {
            count: records.length,
            timestamp: new Date().toISOString(),
        });
    }

    // ===========================================
    // Get All Messages in State
    // ===========================================
    getMessagesInState(state: MessageState): MessageStateRecord[] {
        return Array.from(this.stateCache.values()).filter((r) => r.state === state);
    }

    // ===========================================
    // Get Failed Messages for Retry
    // ===========================================
    getFailedMessages(maxRetries: number = 3): MessageStateRecord[] {
        return Array.from(this.stateCache.values()).filter(
            (r) => r.state === MessageState.FAILED && r.retryCount < maxRetries
        );
    }
}
