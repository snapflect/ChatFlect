/**
 * Scenario: Protocol Abuse (Replay & Duplicates)
 * Epic 16: Reliability
 */

import { ChaosEngine } from '../chaos-harness';
import { OutboxService } from '../../../secure-chat-app/src/app/services/outbox.service';

// Mock HTTP with validation logic
const mockBackend = {
    processedUuids: new Set<string>(),
    post: jest.fn().mockImplementation((url, body) => {
        if (url.includes('send_message')) {
            const uuid = body.message_uuid;
            if (mockBackend.processedUuids.has(uuid)) {
                // Simulate idempotent OK response
                return { success: true, duplicate: true, server_seq: 999 };
            }
            mockBackend.processedUuids.add(uuid);
            return { success: true, server_seq: 100 };
        }
        return { success: false };
    })
};

import { of } from 'rxjs';

describe('Scenario: Protocol Abuse', () => {
    let outbox: OutboxService;
    let chaos: ChaosEngine;

    beforeEach(() => {
        chaos = new ChaosEngine({ duplicateRate: 0.5, seed: 'abuse-seed' }); // High duplicate rate
        const chaoticHttp = {
            post: (url: string, body: any) => chaos.intercept(of(mockBackend.post(url, body)))
        };
        outbox = new OutboxService(chaoticHttp as any);
        mockBackend.processedUuids.clear();
    });

    it('should handle duplicate sends idempotently', async () => {
        // Send single message, chaos will duplicate the HTTP request
        await outbox.enqueue('chat_abuse', 'target', 'payload', 1, 'uuid_abuse_1');

        // Go online and process
        Object.defineProperty(outbox, 'online$', { value: { value: true } });
        await outbox.processQueue();

        // Backend should have seen at least 1, maybe more but handled gracefully
        expect(mockBackend.processedUuids.has('uuid_abuse_1')).toBe(true);
        // Queue should be cleared because at least one succeeded
        let qLen = 1;
        outbox.getQueue().subscribe(q => qLen = q.length);
        expect(qLen).toBe(0);

        console.log('Processed UUIDs:', mockBackend.processedUuids.size);
    });
});
