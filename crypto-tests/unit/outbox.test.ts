/**
 * Outbox Service Tests
 * Epic 15: Offline -> Online Reconciliation
 */
import { OutboxService, OutboxMessage } from '../secure-chat-app/src/app/services/outbox.service';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import * as idb from 'idb-keyval';

// Mock IDB
jest.mock('idb-keyval', () => ({
    get: jest.fn(),
    set: jest.fn()
}));

// Mock HttpClient
const mockHttp = {
    post: jest.fn()
};

describe('OutboxService', () => {
    let service: OutboxService;

    beforeEach(() => {
        jest.clearAllMocks();
        (idb.get as jest.Mock).mockResolvedValue([]);
        service = new OutboxService(mockHttp as any);
        // Force online
        Object.defineProperty(service, 'online$', { value: { value: true } });
    });

    it('should enqueue new message', async () => {
        await service.enqueue('chat1', 'user2', 'enc', 1, 'uuid1');

        expect(idb.set).toHaveBeenCalled();
        const stored = (idb.set as jest.Mock).mock.calls[0][1];
        expect(stored.length).toBe(1);
        expect(stored[0].message_uuid).toBe('uuid1');
        expect(stored[0].state).toBe('QUEUED');
    });

    it('should prevent duplicate enqueue', async () => {
        await service.enqueue('chat1', 'user2', 'enc', 1, 'uuid1');
        await service.enqueue('chat1', 'user2', 'enc', 1, 'uuid1'); // Duplicate

        // Should only save once (after initial load + 1 add)
        // Actually our mock impl re-reads queue$ value which is update in memory
        // Verification: check queue length
        service.getQueue().subscribe(q => {
            expect(q.length).toBe(1);
        });
    });

    it('should process queue when online', async () => {
        mockHttp.post.mockReturnValue(of({ success: true, server_seq: 100 }));

        await service.enqueue('chat1', 'user2', 'enc', 1, 'uuid1');
        await service.processQueue();

        expect(mockHttp.post).toHaveBeenCalled();
        service.getQueue().subscribe(q => {
            // Depending on impl, it might be removed or state=SENT
            // Current impl: removed
            expect(q.length).toBe(0);
        });
    });

    it('should handle failure and retry', async () => {
        mockHttp.post.mockReturnValue(throwError(new Error('Network Fail')));

        await service.enqueue('chat1', 'user2', 'enc', 1, 'uuid1');
        await service.processQueue();

        expect(mockHttp.post).toHaveBeenCalled();
        service.getQueue().subscribe(q => {
            expect(q.length).toBe(1);
            expect(q[0].state).toBe('FAILED');
            expect(q[0].retry_count).toBe(1);
            expect(q[0].next_retry_at).toBeGreaterThan(Date.now());
        });
    });
});
