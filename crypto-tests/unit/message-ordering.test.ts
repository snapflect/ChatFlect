/**
 * Unit Tests for Message Ordering Service
 * Epic 13: Ordering Guarantees (Logical Clock Engine)
 */

import { MessageOrderingService, OrderedMessage } from '../mocks/message-ordering.service';

describe('MessageOrderingService', () => {
    let service: MessageOrderingService;

    beforeEach(() => {
        service = new MessageOrderingService();
    });

    // ===========================================
    // Local Sequence Generation
    // ===========================================
    describe('getNextLocalSeq', () => {
        it('should start at 1 for new chat', () => {
            const seq = service.getNextLocalSeq('chat_001');
            expect(seq).toBe(1);
        });

        it('should increment monotonically', () => {
            expect(service.getNextLocalSeq('chat_002')).toBe(1);
            expect(service.getNextLocalSeq('chat_002')).toBe(2);
            expect(service.getNextLocalSeq('chat_002')).toBe(3);
        });

        it('should track per-chat independently', () => {
            expect(service.getNextLocalSeq('chat_a')).toBe(1);
            expect(service.getNextLocalSeq('chat_b')).toBe(1);
            expect(service.getNextLocalSeq('chat_a')).toBe(2);
        });
    });

    // ===========================================
    // Message Sorting
    // ===========================================
    describe('sortMessages', () => {
        it('should sort by server_seq when available', () => {
            const messages: OrderedMessage[] = [
                { id: 'm3', serverSeq: 3, localSeq: 1, timestamp: 100, content: 'c' },
                { id: 'm1', serverSeq: 1, localSeq: 3, timestamp: 300, content: 'a' },
                { id: 'm2', serverSeq: 2, localSeq: 2, timestamp: 200, content: 'b' },
            ];

            const sorted = service.sortMessages(messages);

            expect(sorted[0].id).toBe('m1');
            expect(sorted[1].id).toBe('m2');
            expect(sorted[2].id).toBe('m3');
        });

        it('should use localSeq for pending messages', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: 1, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm3', serverSeq: null, localSeq: 3, timestamp: 300, content: 'c' },
                { id: 'm2', serverSeq: null, localSeq: 2, timestamp: 200, content: 'b' },
            ];

            const sorted = service.sortMessages(messages);

            expect(sorted[0].id).toBe('m1');
            expect(sorted[1].id).toBe('m2');
            expect(sorted[2].id).toBe('m3');
        });

        it('should fallback to timestamp', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: null, localSeq: 1, timestamp: 300, content: 'c' },
                { id: 'm2', serverSeq: null, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm3', serverSeq: null, localSeq: 1, timestamp: 200, content: 'b' },
            ];

            const sorted = service.sortMessages(messages);

            expect(sorted[0].id).toBe('m2');
            expect(sorted[1].id).toBe('m3');
            expect(sorted[2].id).toBe('m1');
        });
    });

    // ===========================================
    // Gap Detection
    // ===========================================
    describe('detectGaps', () => {
        it('should detect missing sequences', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: 1, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm2', serverSeq: 2, localSeq: 2, timestamp: 200, content: 'b' },
                { id: 'm5', serverSeq: 5, localSeq: 5, timestamp: 500, content: 'e' },
            ];

            const gaps = service.detectGaps('chat_001', messages);

            expect(gaps).toEqual([3, 4]);
        });

        it('should return empty for no gaps', () => {
            const messages: OrderedMessage[] = [
                { id: 'm1', serverSeq: 1, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm2', serverSeq: 2, localSeq: 2, timestamp: 200, content: 'b' },
                { id: 'm3', serverSeq: 3, localSeq: 3, timestamp: 300, content: 'c' },
            ];

            const gaps = service.detectGaps('chat_001', messages);

            expect(gaps).toEqual([]);
        });
    });

    // ===========================================
    // Server Reconciliation
    // ===========================================
    describe('reconcileWithServerOrder', () => {
        it('should update local messages with server sequences', () => {
            const local: OrderedMessage[] = [
                { id: 'm1', serverSeq: null, localSeq: 1, timestamp: 100, content: 'a' },
                { id: 'm2', serverSeq: null, localSeq: 2, timestamp: 200, content: 'b' },
            ];

            const server: OrderedMessage[] = [
                { id: 'm2', serverSeq: 1, localSeq: 2, timestamp: 200, content: 'b' },
                { id: 'm1', serverSeq: 2, localSeq: 1, timestamp: 100, content: 'a' },
            ];

            const result = service.reconcileWithServerOrder(local, server);

            expect(result.reordered).toBe(true);
            expect(result.messages[0].id).toBe('m2'); // Server says m2 is first
            expect(result.messages[1].id).toBe('m1');
        });
    });
});
