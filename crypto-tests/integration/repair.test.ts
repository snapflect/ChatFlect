/**
 * Integration Test: Repair Protocol
 * Epic 14: Repair Protocol (Missing Message Recovery)
 */

import { MessageGapDetectionService } from '../mocks/message-gap-detection.service';
import { MessageRepairServiceMock as MessageRepairService, RepairedMessage } from '../mocks/message-repair.service';

describe('Repair Protocol Integration', () => {
    let gapService: MessageGapDetectionService;
    let repairService: MessageRepairService;

    beforeEach(() => {
        gapService = new MessageGapDetectionService();
        repairService = new MessageRepairService(null, gapService);
    });

    // ===========================================
    // SC-REP-01: Auto-Trigger Repair
    // ===========================================
    describe('SC-REP-01: Auto-Trigger Repair', () => {
        it('should trigger repair when gap is detected', async () => {
            const chatId = 'chat_rep_01';

            // Override triggerRepair logic for this test to inspect calls
            const triggerSpy = jest.spyOn(repairService, 'triggerRepair');

            // Detect gaps: lastKnown=0, received=5 => gaps 2,3,4
            gapService.detectGaps(chatId, 5);

            // Verify triggerRepair was called with correct range
            expect(triggerSpy).toHaveBeenCalled();

            const gap = triggerSpy.mock.calls[0][0];
            expect(gap.fromSeq).toBe(2);
            expect(gap.toSeq).toBe(4);
        });
    });

    // ===========================================
    // SC-REP-02: Deduplication
    // ===========================================
    describe('SC-REP-02: Repair Deduplication', () => {
        it('should skip already processed messages during repair', async () => {
            const chatId = 'chat_rep_02';
            const messages: RepairedMessage[] = [
                { id: 'm10', server_seq: 10, timestamp: 100, encrypted_payload: 'enc', sender_id: 'u1' }
            ];

            // First application (simulates new message)
            let result = await repairService.applyRepairedMessages(chatId, messages);
            expect(result.messagesRecovered).toBe(1);
            expect(result.duplicatesSkipped).toBe(0);

            // Second application (simulates duplicate from another repair)
            result = await repairService.applyRepairedMessages(chatId, messages);
            expect(result.messagesRecovered).toBe(0);
            expect(result.duplicatesSkipped).toBe(1);
        });
    });

    // ===========================================
    // SC-REP-03: Security Limits
    // ===========================================
    describe('SC-REP-03: Security Limits', () => {
        it('should reject invalid range in manual repair', async () => {
            const chatId = 'chat_rep_03';

            // Attempt fromSeq > toSeq
            const result = await repairService.manualRepair(chatId, 10, 5);

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Invalid Range');
        });
    });
});
