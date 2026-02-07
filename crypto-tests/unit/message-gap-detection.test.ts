/**
 * Unit Tests for Message Gap Detection
 * Epic 14: Repair Protocol
 */

import { MessageGapDetectionService, MessageGap } from '../mocks/message-gap-detection.service';

describe('MessageGapDetectionService', () => {
    let service: MessageGapDetectionService;

    beforeEach(() => {
        service = new MessageGapDetectionService();
    });

    // ===========================================
    // Gap Detection
    // ===========================================
    describe('detectGaps', () => {
        it('should detect gap when sequence jumps', () => {
            const chatId = 'chat_001';

            // First message at seq 1
            let result = service.detectGaps(chatId, 1);
            expect(result.detected).toBe(false);

            // Jump to seq 5 (missing 2, 3, 4)
            result = service.detectGaps(chatId, 5);
            expect(result.detected).toBe(true);
            expect(result.gaps).toEqual([2, 3, 4]);
            expect(result.fromSeq).toBe(2);
            expect(result.toSeq).toBe(4);
        });

        it('should not detect gap for sequential messages', () => {
            const chatId = 'chat_002';

            service.detectGaps(chatId, 1);
            const result = service.detectGaps(chatId, 2);

            expect(result.detected).toBe(false);
            expect(result.gaps).toEqual([]);
        });

        it('should not detect gap for old messages', () => {
            const chatId = 'chat_003';

            service.detectGaps(chatId, 10);
            const result = service.detectGaps(chatId, 5); // Old message

            expect(result.detected).toBe(false);
        });
    });

    // ===========================================
    // Gap Management
    // ===========================================
    describe('gap management', () => {
        it('should track active gaps', () => {
            const chatId = 'chat_004';

            service.detectGaps(chatId, 1);
            service.detectGaps(chatId, 5); // Creates gap 2-4

            const gaps = service.getActiveGaps(chatId);
            expect(gaps.length).toBe(1);
            expect(gaps[0].fromSeq).toBe(2);
            expect(gaps[0].toSeq).toBe(4);
        });

        it('should update gap status to repairing', () => {
            const chatId = 'chat_005';

            service.detectGaps(chatId, 1);
            service.detectGaps(chatId, 5);
            service.markGapAsRepairing(chatId, 2);

            const gaps = service.getActiveGaps(chatId);
            expect(gaps[0].status).toBe('REPAIRING');
            expect(gaps[0].retryCount).toBe(1);
        });

        it('should remove gap when repaired', () => {
            const chatId = 'chat_006';

            service.detectGaps(chatId, 1);
            service.detectGaps(chatId, 5);
            service.markGapAsRepaired(chatId, 2);

            const gaps = service.getActiveGaps(chatId);
            expect(gaps.length).toBe(0);
        });
    });

    // ===========================================
    // Large Gap
    // ===========================================
    describe('large gaps', () => {
        it('should detect large gap correctly', () => {
            const chatId = 'chat_007';

            service.detectGaps(chatId, 1);
            const result = service.detectGaps(chatId, 100);

            expect(result.detected).toBe(true);
            expect(result.gaps.length).toBe(98); // 2-99
            expect(result.fromSeq).toBe(2);
            expect(result.toSeq).toBe(99);
        });
    });

    // ===========================================
    // Multiple Chats
    // ===========================================
    describe('multiple chats', () => {
        it('should track gaps independently per chat', () => {
            service.detectGaps('chat_a', 1);
            service.detectGaps('chat_a', 5);

            service.detectGaps('chat_b', 1);
            service.detectGaps('chat_b', 3);

            const gapsA = service.getActiveGaps('chat_a');
            const gapsB = service.getActiveGaps('chat_b');

            expect(gapsA.length).toBe(1);
            expect(gapsA[0].gaps).toEqual([2, 3, 4]);

            expect(gapsB.length).toBe(1);
            expect(gapsB[0].gaps).toEqual([2]);
        });
    });
});
