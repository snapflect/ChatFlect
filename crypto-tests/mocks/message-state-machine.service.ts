/**
 * Mock for Message State Machine Service (used in tests)
 * Simplified version for Jest testing
 */

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

export interface MessageStateRecord {
    messageId: string;
    state: MessageState;
    stateVersion: number;
    lastTransitionAt: Date;
    lastError: string | null;
    retryCount: number;
}

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

const ALLOWED_TRANSITIONS: Record<MessageState, MessageState[]> = {
    [MessageState.CREATED]: [MessageState.ENCRYPTED, MessageState.FAILED],
    [MessageState.ENCRYPTED]: [MessageState.QUEUED, MessageState.FAILED],
    [MessageState.QUEUED]: [MessageState.SENT, MessageState.FAILED, MessageState.QUEUED],
    [MessageState.SENT]: [MessageState.DELIVERED, MessageState.FAILED],
    [MessageState.DELIVERED]: [MessageState.READ],
    [MessageState.READ]: [],
    [MessageState.FAILED]: [MessageState.REPAIRED, MessageState.FAILED],
    [MessageState.REPAIRED]: [MessageState.SENT],
};

export class MessageStateMachineService {
    private stateCache = new Map<string, MessageStateRecord>();

    canTransition(from: MessageState, to: MessageState): boolean {
        return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
    }

    getState(messageId: string): MessageStateRecord | null {
        return this.stateCache.get(messageId) ?? null;
    }

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
        return record;
    }

    applyTransition(
        messageId: string,
        toState: MessageState,
        error?: string
    ): { success: boolean; record?: MessageStateRecord; error?: string } {
        const current = this.stateCache.get(messageId);

        if (!current) {
            return { success: false, error: `Message ${messageId} not found` };
        }

        if (!this.canTransition(current.state, toState)) {
            return {
                success: false,
                error: `Transition ${STATE_NAMES[current.state]} -> ${STATE_NAMES[toState]} not allowed`,
            };
        }

        const newRecord: MessageStateRecord = {
            ...current,
            state: toState,
            stateVersion: current.stateVersion + 1,
            lastTransitionAt: new Date(),
            lastError: toState === MessageState.FAILED ? (error ?? 'Unknown') : null,
            retryCount: toState === MessageState.FAILED ? current.retryCount + 1 : current.retryCount,
        };

        this.stateCache.set(messageId, newRecord);
        return { success: true, record: newRecord };
    }

    getFailedMessages(maxRetries: number = 3): MessageStateRecord[] {
        return Array.from(this.stateCache.values()).filter(
            (r) => r.state === MessageState.FAILED && r.retryCount < maxRetries
        );
    }
}
