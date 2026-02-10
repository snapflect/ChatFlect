/**
 * Message Repair Service
 * Epic 14: Repair Protocol (Missing Message Recovery)
 *
 * Executes repair requests and applies recovered messages.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, from, of } from 'rxjs';
import { catchError, map, retry, delay, concatMap } from 'rxjs/operators';
import { MessageGapDetectionService, MessageGap } from './message-gap-detection.service';

// ===========================================
// Types
// ===========================================
export interface RepairedMessage {
    id: string;
    server_seq: number;
    timestamp: number;
    encrypted_payload: string | null;
    sender_id: string | null;
}

export interface RepairResponse {
    messages: RepairedMessage[];
    total: number;
    from_seq: number;
    to_seq: number;
    chat_id: string;
}

export interface RepairResult {
    success: boolean;
    messagesRecovered: number;
    duplicatesSkipped: number;
    errors: string[];
}

// ===========================================
// Retry Delays (ms)
// ===========================================
const RETRY_DELAYS = [0, 5000, 30000, 300000]; // Immediate, 5s, 30s, 5min

@Injectable({
    providedIn: 'root',
})
export class MessageRepairService {
    private apiBase = '/api/v3';
    private repairComplete$ = new Subject<RepairResult>();

    // Local message store (would integrate with actual storage)
    private processedMessages = new Set<string>();

    constructor(
        private http: HttpClient,
        private gapDetection: MessageGapDetectionService
    ) {
        // Auto-trigger repair on gap detection
        this.gapDetection.onGapDetected().subscribe((gap) => {
            this.triggerRepair(gap);
        });
    }

    // ===========================================
    // Trigger Repair
    // ===========================================
    async triggerRepair(gap: MessageGap): Promise<RepairResult> {
        this.gapDetection.markGapAsRepairing(gap.chatId, gap.fromSeq);

        try {
            const response = await this.fetchMissingMessages(
                gap.chatId,
                gap.fromSeq,
                gap.toSeq
            );

            if (!response || !response.messages) {
                throw new Error('Empty repair response');
            }

            const result = await this.applyRepairedMessages(gap.chatId, response.messages);

            this.gapDetection.markGapAsRepaired(gap.chatId, gap.fromSeq);
            this.repairComplete$.next(result);

            return result;
        } catch (error) {
            console.error('Repair failed:', error);

            if (gap.retryCount < RETRY_DELAYS.length) {
                // Schedule retry
                const delayMs = RETRY_DELAYS[gap.retryCount] || 300000;
                setTimeout(() => this.triggerRepair(gap), delayMs);
            } else {
                this.gapDetection.markGapAsFailed(gap.chatId, gap.fromSeq);
            }

            return {
                success: false,
                messagesRecovered: 0,
                duplicatesSkipped: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }

    // ===========================================
    // Fetch Missing Messages
    // ===========================================
    private async fetchMissingMessages(
        chatId: string,
        fromSeq: number,
        toSeq: number
    ): Promise<RepairResponse> {
        const url = `${this.apiBase}/repair.php?chatId=${encodeURIComponent(chatId)}&fromSeq=${fromSeq}&toSeq=${toSeq}`;

        return this.http
            .get<RepairResponse>(url, { withCredentials: true })
            .pipe(
                retry(2),
                catchError((err) => {
                    throw new Error(`Fetch failed: ${err.status} ${err.message}`);
                })
            )
            .toPromise() as Promise<RepairResponse>;
    }

    // ===========================================
    // Apply Repaired Messages
    // ===========================================
    private async applyRepairedMessages(
        chatId: string,
        messages: RepairedMessage[]
    ): Promise<RepairResult> {
        let recovered = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const msg of messages) {
            try {
                // Check for duplicate
                const msgKey = `${chatId}:${msg.server_seq}`;
                if (this.processedMessages.has(msgKey)) {
                    skipped++;
                    continue;
                }

                // Mark as processed
                this.processedMessages.add(msgKey);
                recovered++;

                // In real implementation: decrypt and insert into local DB
                // await this.localDb.insertMessage(chatId, msg);
            } catch (err) {
                errors.push(`Failed to apply message ${msg.id}: ${err}`);
            }
        }

        return {
            success: errors.length === 0,
            messagesRecovered: recovered,
            duplicatesSkipped: skipped,
            errors,
        };
    }

    // ===========================================
    // Manual Repair Trigger
    // ===========================================
    async manualRepair(chatId: string, fromSeq: number, toSeq: number): Promise<RepairResult> {
        const gap: MessageGap = {
            chatId,
            fromSeq,
            toSeq,
            status: 'PENDING_REPAIR',
            retryCount: 0,
            createdAt: new Date(),
        };

        return this.triggerRepair(gap);
    }

    // ===========================================
    // Observable
    // ===========================================
    onRepairComplete(): Observable<RepairResult> {
        return this.repairComplete$.asObservable();
    }

    // ===========================================
    // Stats
    // ===========================================
    getProcessedCount(): number {
        return this.processedMessages.size;
    }

    clearProcessedCache(): void {
        this.processedMessages.clear();
    }
}
