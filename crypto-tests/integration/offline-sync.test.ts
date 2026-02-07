/**
 * Integration Test: Offline -> Online Flow
 * Epic 15
 */
import { OutboxService } from '../../secure-chat-app/src/app/services/outbox.service';
import { MessageOrderingService } from '../../secure-chat-app/src/app/services/message-ordering.service';
import { ChatServiceMock } from '../mocks/chat.service'; // We'd need to mock ChatService logic or use real one with mocks

describe('Offline -> Online Reconciliation', () => {
    let ordering: MessageOrderingService;

    beforeEach(() => {
        ordering = new MessageOrderingService();
    });

    it('should sort confirmed messages before pending messages', () => {
        const messages = [
            { id: 'm1', server_seq: null, local_seq: 1, timestamp: 200 }, // Pending
            { id: 'm2', server_seq: 10, local_seq: 1, timestamp: 100 },   // Confirmed
        ];

        const sorted = ordering.sortMessages(messages);

        expect(sorted[0].id).toBe('m2'); // Confirmed first
        expect(sorted[1].id).toBe('m1'); // Pending last
    });

    it('should sort multiple confirmed by server_seq', () => {
        const messages = [
            { id: 'm2', server_seq: 10, local_seq: 1, timestamp: 100 },
            { id: 'm3', server_seq: 5, local_seq: 1, timestamp: 50 },
        ];
        expect(ordering.sortMessages(messages)[0].id).toBe('m3');
    });

    it('should sort multiple pending by local_seq', () => {
        const messages = [
            { id: 'p2', server_seq: null, local_seq: 2, timestamp: 100 },
            { id: 'p1', server_seq: null, local_seq: 1, timestamp: 50 },
        ];
        expect(ordering.sortMessages(messages)[0].id).toBe('p1');
    });
});
