/**
 * Mock for Message Gap Detection Service (Jest testing)
 */

export interface MessageGap {
    chatId: string;
    fromSeq: number;
    toSeq: number;
    status: GapStatus;
    retryCount: number;
    createdAt: Date;
    repairedAt?: Date;
    gaps?: number[];
}

export type GapStatus = 'PENDING_REPAIR' | 'REPAIRING' | 'REPAIRED' | 'REPAIR_FAILED';

export interface GapDetectionResult {
    detected: boolean;
    gaps: number[];
    fromSeq: number;
    toSeq: number;
}

export class MessageGapDetectionService {
    private lastKnownSeq = new Map<string, number>();
    private activeGaps = new Map<string, MessageGap[]>();
    private listeners: ((gap: MessageGap) => void)[] = [];

    detectGaps(chatId: string, receivedSeq: number): GapDetectionResult {
        const lastSeq = this.lastKnownSeq.get(chatId) ?? 0;
        const expectedSeq = lastSeq + 1;

        if (receivedSeq <= expectedSeq) {
            if (receivedSeq === expectedSeq) {
                this.lastKnownSeq.set(chatId, receivedSeq);
            }
            return { detected: false, gaps: [], fromSeq: 0, toSeq: 0 };
        }

        const gaps: number[] = [];
        for (let seq = expectedSeq; seq < receivedSeq; seq++) {
            gaps.push(seq);
        }

        this.lastKnownSeq.set(chatId, receivedSeq);

        const gap: MessageGap = {
            chatId,
            fromSeq: expectedSeq,
            toSeq: receivedSeq - 1,
            status: 'PENDING_REPAIR',
            retryCount: 0,
            createdAt: new Date(),
            gaps,
        };

        const existing = this.activeGaps.get(chatId) ?? [];
        existing.push(gap);
        this.activeGaps.set(chatId, existing);

        this.listeners.forEach((cb) => cb(gap));

        return { detected: true, gaps, fromSeq: expectedSeq, toSeq: receivedSeq - 1 };
    }

    getActiveGaps(chatId: string): MessageGap[] {
        return this.activeGaps.get(chatId) ?? [];
    }

    getAllActiveGaps(): MessageGap[] {
        const all: MessageGap[] = [];
        this.activeGaps.forEach((gaps) => all.push(...gaps));
        return all;
    }

    markGapAsRepairing(chatId: string, fromSeq: number): void {
        const gaps = this.activeGaps.get(chatId) ?? [];
        const gap = gaps.find((g) => g.fromSeq === fromSeq);
        if (gap) {
            gap.status = 'REPAIRING';
            gap.retryCount++;
        }
    }

    markGapAsRepaired(chatId: string, fromSeq: number): void {
        const gaps = this.activeGaps.get(chatId) ?? [];
        const index = gaps.findIndex((g) => g.fromSeq === fromSeq);
        if (index >= 0) {
            gaps.splice(index, 1);
            this.activeGaps.set(chatId, gaps);
        }
    }

    markGapAsFailed(chatId: string, fromSeq: number): void {
        const gaps = this.activeGaps.get(chatId) ?? [];
        const gap = gaps.find((g) => g.fromSeq === fromSeq);
        if (gap) {
            gap.status = 'REPAIR_FAILED';
        }
    }

    onGapDetected(callback: (gap: MessageGap) => void): void {
        this.listeners.push(callback);
    }

    reset(chatId: string): void {
        this.lastKnownSeq.delete(chatId);
        this.activeGaps.delete(chatId);
    }

    resetAll(): void {
        this.lastKnownSeq.clear();
        this.activeGaps.clear();
    }
}
