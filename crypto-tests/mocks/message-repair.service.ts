/**
 * Mock for Message Repair Service (Jest testing)
 */

import { Subject } from 'rxjs';
import { MessageGapDetectionService, MessageGap } from './message-gap-detection.service';

export interface RepairedMessage {
    id: string;
    server_seq: number;
    timestamp: number;
    encrypted_payload: string | null;
    sender_id: string | null;
}

export interface RepairResult {
    success: boolean;
    messagesRecovered: number;
    duplicatesSkipped: number;
    errors: string[];
}

export class MessageRepairServiceMock {
    private processedMessages = new Set<string>();
    public repairComplete$ = new Subject<RepairResult>();

    constructor(
        private http: any,
        private gapDetection: MessageGapDetectionService
    ) {
        this.gapDetection.onGapDetected((gap) => {
            this.triggerRepair(gap);
        });
    }

    async triggerRepair(gap: MessageGap): Promise<RepairResult> {
        if (gap.fromSeq > gap.toSeq) {
            return {
                success: false,
                messagesRecovered: 0,
                duplicatesSkipped: 0,
                errors: ['Invalid Range']
            };
        }

        return {
            success: true,
            messagesRecovered: gap.toSeq - gap.fromSeq + 1,
            duplicatesSkipped: 0,
            errors: []
        };
    }

    async manualRepair(chatId: string, fromSeq: number, toSeq: number): Promise<RepairResult> {
        const gap: MessageGap = {
            chatId,
            fromSeq,
            toSeq,
            status: 'PENDING_REPAIR',
            retryCount: 0,
            createdAt: new Date()
        };
        return this.triggerRepair(gap);
    }

    async applyRepairedMessages(chatId: string, messages: RepairedMessage[]): Promise<RepairResult> {
        let recovered = 0;
        let skipped = 0;

        for (const msg of messages) {
            const key = `${chatId}:${msg.server_seq}`;
            if (this.processedMessages.has(key)) {
                skipped++;
            } else {
                this.processedMessages.add(key);
                recovered++;
            }
        }

        return {
            success: true,
            messagesRecovered: recovered,
            duplicatesSkipped: skipped,
            errors: []
        };
    }
}
