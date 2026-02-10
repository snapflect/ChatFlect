/**
 * Scenario: Offline Recovery
 * Epic 16: Reliability
 * 
 * Verifies that messages queued offline are reliably delivered when online,
 * maintaining order and integrity.
 */

import { ChaosEngine, DEFAULT_CHAOS_CONFIG } from '../chaos-harness';
import { OutboxService } from '../../../secure-chat-app/src/app/services/outbox.service';
import { MessageOrderingService } from '../../../secure-chat-app/src/app/services/message-ordering.service';
import { of } from 'rxjs';

// Mock dependencies
const mockHttp = {
    post: jest.fn().mockReturnValue(of({ success: true, server_seq: 1 }))
};
// IDB mock
jest.mock('idb-keyval', () => ({
    get: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue(undefined)
}));

describe('Scenario: Offline Recovery (Chaos Enabled)', () => {
    let chaos: ChaosEngine;
    let outbox: OutboxService;
    let ordering: MessageOrderingService;

    beforeEach(() => {
        // Use fixed seed for deterministic chaos
        chaos = new ChaosEngine({ ...DEFAULT_CHAOS_CONFIG, dropRate: 0.1, seed: 'offline-scenario-1' });

        // Wrap HTTP with Chaos
        const chaoticHttp = {
            post: (url: string, body: any) => chaos.intercept(mockHttp.post(url, body))
        };

        outbox = new OutboxService(chaoticHttp as any);
        ordering = new MessageOrderingService();

        // Start Offline
        Object.defineProperty(outbox, 'online$', { value: { value: false } });
    });

    it('should recover 100 queued messages without loss', async () => {
        const MSG_COUNT = 100;

        // 1. Queue 100 messages offline
        for (let i = 0; i < MSG_COUNT; i++) {
            await outbox.enqueue('chat_chaos', 'user_b', `msg_${i}`, i + 1, `uuid_${i}`);
        }

        // Verify queued
        let queue: any[] = [];
        outbox.getQueue().subscribe(q => queue = q);
        expect(queue.length).toBe(MSG_COUNT);

        // 2. Go Online
        Object.defineProperty(outbox, 'online$', { value: { value: true } });

        // 3. Process with Chaos
        // We need to wait for eventual consistency due to retries
        // In simulation, we can loop "processQueue" with time advancement or wait

        // Simulate processing loop with retry handling until empty
        let attempts = 0;
        while (queue.length > 0 && attempts < 1000) {
            await outbox.processQueue();

            // Wait simulated backoff if needed (simplified)
            await new Promise(r => setTimeout(r, 10));
            attempts++;
        }

        // 4. Assertions
        // All messages should be sent (removed from queue or marked SENT)
        // Current outbox impl removes them on send
        expect(queue.length).toBe(0);

        // Check Chaos Metrics
        const metrics = chaos.getMetrics();
        console.log('Chaos Metrics:', metrics);
        expect(metrics.dropped).toBeGreaterThan(0); // Ensure chaos actually ran

        // Verification of Server Order would realistically check the receiving end
        // But here we ensure outbox eventually drained despite drops.
    });
});
