/**
 * Scenario: App Crash Recovery
 * Epic 16: Reliability
 * 
 * Verifies that the Outbox Service persists messages correctly
 * and resumes sending after an "app restart".
 */

import { ChaosEngine, DEFAULT_CHAOS_CONFIG } from '../chaos-harness';
import { OutboxService } from '../../../secure-chat-app/src/app/services/outbox.service';
import * as idb from 'idb-keyval';
import { of } from 'rxjs';

// Mock dependencies
const mockHttp = {
    post: jest.fn().mockReturnValue(of({ success: true, server_seq: 1 }))
};

// We need a persistent mock for IDB to simulate restart
const persistentStore = new Map<string, any>();
jest.mock('idb-keyval', () => ({
    get: jest.fn().mockImplementation((key) => Promise.resolve(persistentStore.get(key))),
    set: jest.fn().mockImplementation((key, val) => {
        persistentStore.set(key, val);
        return Promise.resolve();
    })
}));

describe('Scenario: App Crash Recovery', () => {
    let chaos: ChaosEngine;
    let outbox: OutboxService;

    beforeEach(() => {
        chaos = new ChaosEngine({ ...DEFAULT_CHAOS_CONFIG, seed: 'crash-seed' });
        persistentStore.clear();
        jest.clearAllMocks();
    });

    it('should resume sending after app restart', async () => {
        // --- INSTANCE 1 (Before Crash) ---
        const chaoticHttp1 = {
            post: (url: string, body: any) => chaos.intercept(mockHttp.post(url, body))
        };
        const outbox1 = new OutboxService(chaoticHttp1 as any);

        // Start offline
        Object.defineProperty(outbox1, 'online$', { value: { value: false } });

        // Enqueue messages
        await outbox1.enqueue('chat1', 'user2', 'msg1', 1, 'uuid1');
        await outbox1.enqueue('chat1', 'user2', 'msg2', 2, 'uuid2');

        // Verify persisted
        expect(persistentStore.get('chat_outbox_queue')).toHaveLength(2);

        // --- CRASH / RESTART ---
        // Create new instance (simulates restart), reading from same mock IDB
        const chaoticHttp2 = {
            post: (url: string, body: any) => chaos.intercept(mockHttp.post(url, body))
        };
        const outbox2 = new OutboxService(chaoticHttp2 as any);

        // Should auto-load from IDB
        let queue: any[] = [];
        outbox2.getQueue().subscribe(q => queue = q);

        // Wait for init promise (simulated by tick)
        await new Promise(r => setTimeout(r, 0));

        // Verify loaded
        expect(queue).toHaveLength(2);
        expect(queue[0].message_uuid).toBe('uuid1');

        // --- RECOVERY ---
        // Go online
        Object.defineProperty(outbox2, 'online$', { value: { value: true } });

        // Process
        await outbox2.processQueue();

        // Verify output
        expect(mockHttp.post).toHaveBeenCalledTimes(2);
        expect(queue).toHaveLength(0);
    });
});
