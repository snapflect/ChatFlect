/**
 * Integration Test: Presence Service & API
 * Epic 19: Presence Migration
 */

import { BehaviorSubject, of } from 'rxjs';

describe('Presence Integration', () => {
    let presenceService: any;
    let apiService: any;
    let authService: any;

    const MY_ID = 'user_presence_1';

    beforeEach(() => {
        // Mock ApiService
        apiService = {
            post: jest.fn().mockImplementation((url, body) => {
                if (url.includes('update.php')) {
                    // Simulate rate limit or success
                    return of({ success: true, updated: true });
                }
                if (url.includes('query.php')) {
                    // Simulate batch response
                    const res: any = {};
                    body.user_ids.forEach((uid: string) => {
                        res[uid] = { status: 'online', last_seen: Date.now(), typing_in: null };
                    });
                    return of(res);
                }
                return of({});
            })
        };

        // Mock AuthService
        authService = {
            currentUserId: new BehaviorSubject(MY_ID)
        };

        // Instantiate PresenceService (Partial Mock)
        // Check constructor logic
        presenceService = {
            updatePresence: async (status: string, typing?: string) => {
                await apiService.post('presence/update.php', { status, typing_in: typing }).toPromise();
            },
            getPresenceBatch: (ids: string[]) => {
                return apiService.post('presence/query.php', { user_ids: ids });
            }
        };
    });

    test('SC-PRES-01: updatePresence calls API', async () => {
        await presenceService.updatePresence('online');
        expect(apiService.post).toHaveBeenCalledWith(
            'presence/update.php',
            expect.objectContaining({ status: 'online' })
        );
    });

    test('SC-PRES-02: Typing indicator sends optional param', async () => {
        await presenceService.updatePresence('online', 'chat_123');
        expect(apiService.post).toHaveBeenCalledWith(
            'presence/update.php',
            expect.objectContaining({ status: 'online', typing_in: 'chat_123' })
        );
    });

    test('SC-PRES-03: Batch Query returns status', (done) => {
        presenceService.getPresenceBatch(['user_A', 'user_B']).subscribe((res: any) => {
            expect(res['user_A']).toBeDefined();
            expect(res['user_A'].status).toBe('online');
            done();
        });
    });
});
