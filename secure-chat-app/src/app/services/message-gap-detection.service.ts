/**
 * Message Gap Detection Service
 * Epic 14: Repair Protocol (Missing Message Recovery)
 *
 * Detects missing message sequences and triggers repair requests.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

// ===========================================
// Types
// ===========================================
export interface MessageGap {
    chatId: string;
    fromSeq: number;
    toSeq: number;
    status: GapStatus;
    retryCount: number;
    createdAt: Date;
    repairedAt?: Date;
}

export type GapStatus = 'PENDING_REPAIR' | 'REPAIRING' | 'REPAIRED' | 'REPAIR_FAILED';

export interface GapDetectionResult {
    detected: boolean;
    gaps: number[];
    fromSeq: number;
    toSeq: number;
}

// ===========================================
// Service
// ===========================================
@Injectable({
    providedIn: 'root',
})
export class MessageGapDetectionService {
    // Per-chat last known sequence
    private lastKnownSeq = new Map<string, number>();

    // Active gaps awaiting repair
    private activeGaps = new Map<string, MessageGap[]>();

    // Gap detection events
    private gapDetected$ = new Subject<MessageGap>();

    constructor() { }

    // ===========================================
    // Gap Detection
    // ===========================================
    detectGaps(chatId: string, receivedSeq: number): GapDetectionResult {
        const lastSeq = this.lastKnownSeq.get(chatId) ?? 0;
        const expectedSeq = lastSeq + 1;

        // No gap if received is expected or earlier
        if (receivedSeq <= expectedSeq) {
            // Update last known if this is a new message
            if (receivedSeq === expectedSeq) {
                this.lastKnownSeq.set(chatId, receivedSeq);
            }
            return { detected: false, gaps: [], fromSeq: 0, toSeq: 0 };
        }

        // Gap detected!
        const gaps: number[] = [];
        for (let seq = expectedSeq; seq < receivedSeq; seq++) {
            gaps.push(seq);
        }

        // Update last known to received
        this.lastKnownSeq.set(chatId, receivedSeq);

        // Create gap record
        const gap: MessageGap = {
            chatId,
            fromSeq: expectedSeq,
            toSeq: receivedSeq - 1,
            status: 'PENDING_REPAIR',
            retryCount: 0,
            createdAt: new Date(),
        };

        // Track active gap
        this.addActiveGap(chatId, gap);

        // Emit detection event
        this.gapDetected$.next(gap);

        return {
            detected: true,
            gaps,
            fromSeq: expectedSeq,
            toSeq: receivedSeq - 1,
        };
    }

    // ===========================================
    // Gap Management
    // ===========================================
    private addActiveGap(chatId: string, gap: MessageGap): void {
        const existing = this.activeGaps.get(chatId) ?? [];
        existing.push(gap);
        this.activeGaps.set(chatId, existing);
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
        const gapIndex = gaps.findIndex((g) => g.fromSeq === fromSeq);
        if (gapIndex >= 0) {
            gaps[gapIndex].status = 'REPAIRED';
            gaps[gapIndex].repairedAt = new Date();
            // Remove from active gaps
            gaps.splice(gapIndex, 1);
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

    // ===========================================
    // Observables
    // ===========================================
    onGapDetected(): Observable<MessageGap> {
        return this.gapDetected$.asObservable();
    }

    // ===========================================
    // Initialize from Messages
    // ===========================================
    initializeFromMessages(chatId: string, serverSeqs: number[]): void {
        if (serverSeqs.length === 0) return;
        const maxSeq = Math.max(...serverSeqs);
        this.lastKnownSeq.set(chatId, maxSeq);
    }

    // ===========================================
    // Reset
    // ===========================================
    reset(chatId: string): void {
        this.lastKnownSeq.delete(chatId);
        this.activeGaps.delete(chatId);
    }

    resetAll(): void {
        this.lastKnownSeq.clear();
        this.activeGaps.clear();
    }
}
