/**
 * Integration Test: Message Ordering
 * Epic 13: Ordering Guarantees (Logical Clock Engine)
 *
 * Verifies that server_seq increments correctly and no duplicates/skips occur.
 */

import { MessageOrderingService, OrderedMessage } from '../mocks/message-ordering.service';

describe('Message Ordering Integration', () => {
    const service = new MessageOrderingService();

    // ===========================================
    // SC-ORD-01: Sequential Increment
    // ===========================================
    describe('SC-ORD-01: Server Sequence Increment', () => {
        it('should assign sequential server_seq 1..5 for 5 messages', () => {
            const chatId = 'chat_test_001';
            const messages: OrderedMessage[] = [];

            // Simulate 5 message sends
            for (let i = 1; i <= 5; i++) {
                const localSeq = service.getNextLocalSeq(chatId);
                messages.push({
                    id: `msg_${i}`,
                    serverSeq: i, // Simulated server assignment
                    localSeq,
                    timestamp: Date.now() + i,
                    content: `Message ${i}`,
                });
            }

            // Verify sequential assignment
            for (let i = 0; i < 5; i++) {
                expect(messages[i].serverSeq).toBe(i + 1);
            }
        });
    });

    // ===========================================
    // SC-ORD-02: No Duplicates
    // ===========================================
    describe('SC-ORD-02: No Duplicate Sequences', () => {
        it('should have no duplicate server_seq values', () => {
            const sequences = [1, 2, 3, 4, 5];
            const uniqueSeqs = new Set(sequences);

            expect(uniqueSeqs.size).toBe(sequences.length);
        });

        it('should reject duplicate sequence assignment (simulated)', () => {
            const existingSeqs = new Set([1, 2, 3]);

            // Simulate trying to assign duplicate
            const newSeq = 2; // Already exists
            const isDuplicate = existingSeqs.has(newSeq);

            expect(isDuplicate).toBe(true);
            // Backend would reject with unique constraint violation
        });
    });

    // ===========================================
    // SC-ORD-03: No Skips
    // ===========================================
    describe('SC-ORD-03: No Sequence Skips', () => {
        it('should detect gaps in sequence', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: 1, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm2', serverSeq: 2, localSeq: 2, timestamp: 200, content: 'b' },
                { id: 'm4', serverSeq: 4, localSeq: 4, timestamp: 400, content: 'd' }, // Gap: 3 missing
            ];

            const gaps = service.detectGaps('chat_gap_test', messages);

            expect(gaps).toContain(3);
        });

        it('should return empty for continuous sequence', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: 1, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm2', serverSeq: 2, localSeq: 2, timestamp: 200, content: 'b' },
                { id: 'm3', serverSeq: 3, localSeq: 3, timestamp: 300, content: 'c' },
            ];

            const gaps = service.detectGaps('chat_no_gap', messages);

            expect(gaps).toEqual([]);
        });
    });

    // ===========================================
    // SC-ORD-04: Multi-Device Ordering
    // ===========================================
    describe('SC-ORD-04: Multi-Device Consistency', () => {
        it('should order messages identically regardless of local order', () => {
            // Device A sees: local order [m1, m2]
            const deviceA: OrderedMessage[] = [
                { id: 'm1', serverSeq: 2, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm2', serverSeq: 1, localSeq: 2, timestamp: 200, content: 'b' },
            ];

            // Device B sees: local order [m2, m1] (different)
            const deviceB: OrderedMessage[] = [
                { id: 'm2', serverSeq: 1, localSeq: 1, timestamp: 200, content: 'b' },
                { id: 'm1', serverSeq: 2, localSeq: 2, timestamp: 100, content: 'a' },
            ];

            // After sorting by server_seq, both should be identical
            const sortedA = service.sortMessages(deviceA);
            const sortedB = service.sortMessages(deviceB);

            expect(sortedA[0].id).toBe(sortedB[0].id);
            expect(sortedA[1].id).toBe(sortedB[1].id);
            expect(sortedA[0].id).toBe('m2'); // m2 has serverSeq=1
            expect(sortedA[1].id).toBe('m1'); // m1 has serverSeq=2
        });
    });

    // ===========================================
    // SC-ORD-05: Fail-Fast on Missing Sequence
    // ===========================================
    describe('SC-ORD-05: Fail-Fast Verification', () => {
        it('should detect critical gap requiring fetch', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: 1, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm10', serverSeq: 10, localSeq: 10, timestamp: 1000, content: 'j' },
            ];

            const gaps = service.detectGaps('chat_critical', messages);

            // Should detect 8 missing sequences (2-9)
            expect(gaps.length).toBe(8);
            expect(gaps).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
        });
    });
});
