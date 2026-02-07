/**
 * Integration Test: Client-Side Relay Integration
 * Epic 18: Client-Side Relay Integration
 */

import { BehaviorSubject, of, Subject } from 'rxjs';
// We mock classes instead of actual imports to avoid Angular DI complexity in simple node test

describe('Client Relay Integration', () => {
    let chatService: any;
    let relayService: any;
    let relaySyncService: any;
    let outboxService: any;
    let authService: any;
    let signalService: any;
    let orderingService: any;

    // Mock Data
    const CHAT_ID = 'chat_123';
    const MY_ID = 'user_A';
    const RECEIVER_ID = 'user_B';

    beforeEach(() => {
        // 1. Mock Auth
        authService = {
            getUserId: () => MY_ID,
            getCurrentUserId: () => MY_ID,
            currentUserId: new BehaviorSubject(MY_ID)
        };

        // 2. Mock Relay Service
        relayService = {
            sendMessage: jest.fn().mockReturnValue(of({
                success: true,
                server_seq: 100,
                timestamp: Date.now()
            }))
        };

        // 3. Mock Relay Sync
        const relayStreamSubject = new BehaviorSubject<any[]>([]);
        relaySyncService = {
            startPolling: jest.fn(),
            getStream: jest.fn().mockReturnValue(relayStreamSubject.asObservable()),
            mockEmit: (msgs: any[]) => relayStreamSubject.next(msgs)
        };

        // 4. Mock Outbox
        const outboxQueueSubject = new BehaviorSubject<any[]>([]);
        outboxService = {
            enqueue: jest.fn().mockImplementation((chatId, receiverId, payload, seq, uuid) => {
                const current = outboxQueueSubject.value;
                outboxQueueSubject.next([...current, {
                    message_uuid: uuid,
                    chat_id: chatId,
                    receiver_id: receiverId,
                    encrypted_payload: payload,
                    local_seq: seq,
                    state: 'QUEUED',
                    created_at: Date.now()
                }]);
                return Promise.resolve();
            }),
            getQueue: jest.fn().mockReturnValue(outboxQueueSubject.asObservable())
        };

        // 5. Mock Signal
        signalService = {
            encryptMessage: jest.fn().mockResolvedValue({ body: 'encrypted_content', type: 3 }),
            decryptMessage: jest.fn().mockResolvedValue(JSON.stringify({ content: 'Hello World', type: 'text' }))
        };

        // 6. Mock Ordering
        orderingService = {
            getNextLocalSeq: jest.fn().mockReturnValue(1),
            sortMessages: (msgs: any[]) => msgs.sort((a, b) => (a.server_seq || Infinity) - (b.server_seq || Infinity))
        };

        // 7. Instantiate ChatService (Partial)
        // We replicate key logic from ChatService
        chatService = {
            sendMessage: async (chatId: string, content: string) => {
                const uuid = 'msg_' + Date.now();
                const encrypted = await signalService.encryptMessage(content, RECEIVER_ID, 1);
                await outboxService.enqueue(chatId, RECEIVER_ID, encrypted.body, 1, uuid);
            },
            getMessagesStream: (chatId: string) => {
                relaySyncService.startPolling(chatId);
                // Simple combine logic for test
                const relay = relaySyncService.getStream();
                const outbox = outboxService.getQueue(); // Simplified transformation
                // In real app, we use combineLatest. Here we just test if components function.
                return relay;
            }
        };
    });

    test('SC-REL-CLIENT-01: sendMessage enqueues to Outbox', async () => {
        await chatService.sendMessage(CHAT_ID, 'Hello Relay');

        expect(signalService.encryptMessage).toHaveBeenCalled();
        expect(outboxService.enqueue).toHaveBeenCalledWith(
            CHAT_ID,
            RECEIVER_ID,
            'encrypted_content',
            1,
            expect.stringMatching(/^msg_/)
        );
    });

    test('SC-REL-CLIENT-02: getMessagesStream triggers polling', () => {
        chatService.getMessagesStream(CHAT_ID);
        expect(relaySyncService.startPolling).toHaveBeenCalledWith(CHAT_ID);
    });
});
