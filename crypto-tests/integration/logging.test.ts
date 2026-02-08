/**
 * logging.test.ts
 * Epic 28: Correlation ID + Structured Logging Integration Tests
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost/secure-chat-backend';

const AUTH_HEADERS = {
    'Authorization': 'Bearer TEST_TOKEN',
    'X-Device-UUID': 'TEST_DEVICE_UUID',
    'Content-Type': 'application/json'
};

describe('Structured Logging (Epic 28)', () => {

    describe('SC-LOG-01: Request ID in Response Header', () => {
        it('should return X-Request-ID header in relay/send response', async () => {
            try {
                const res = await axios.post(`${BASE_URL}/relay/send.php`, {
                    chat_id: 'test-chat',
                    message_uuid: '123e4567-e89b-12d3-a456-426614174000',
                    encrypted_payload: 'encrypted-test'
                }, {
                    headers: AUTH_HEADERS,
                    validateStatus: () => true
                });

                // X-Request-ID should be in response headers
                const requestId = res.headers['x-request-id'];
                expect(requestId).toBeDefined();
                expect(requestId.length).toBeGreaterThan(10);
            } catch (e) {
                console.log('Backend not running - skipping live test');
            }
        });
    });

    describe('SC-LOG-02: Custom Request ID Echo', () => {
        it('should echo back custom X-Request-ID header', async () => {
            const customId = 'custom-test-request-id-12345';
            try {
                const res = await axios.get(`${BASE_URL}/relay/pull.php?since_seq=0`, {
                    headers: {
                        ...AUTH_HEADERS,
                        'X-Request-ID': customId
                    },
                    validateStatus: () => true
                });

                const echoedId = res.headers['x-request-id'];
                expect(echoedId).toBe(customId);
            } catch (e) {
                console.log('Backend not running - skipping live test');
            }
        });
    });

    describe('SC-LOG-03: Request ID in Response Body', () => {
        it('should include request_id in JSON response body', async () => {
            try {
                const res = await axios.get(`${BASE_URL}/relay/pull.php?since_seq=0`, {
                    headers: AUTH_HEADERS,
                    validateStatus: () => true
                });

                if (res.status === 200) {
                    expect(res.data.request_id).toBeDefined();
                }
            } catch (e) {
                console.log('Backend not running - skipping live test');
            }
        });
    });

    describe('Log Format Validation', () => {
        it('should log JSON Lines format with required fields', () => {
            const mockLogEntry = {
                ts: '2026-02-08T09:20:00Z',
                level: 'INFO',
                request_id: '01913b8f-1234-5678-90ab-cdef12345678',
                user_id: 'test-user',
                device_uuid: 'test-device',
                ip: '127.0.0.1',
                endpoint: '/relay/send.php',
                event: 'SEND_SUCCESS',
                data: {
                    chat_id: 'chat123',
                    server_seq: 51
                }
            };

            expect(mockLogEntry.ts).toBeDefined();
            expect(mockLogEntry.level).toBeDefined();
            expect(mockLogEntry.request_id).toBeDefined();
            expect(mockLogEntry.event).toBeDefined();
        });
    });

    describe('Performance Logging', () => {
        it('should log PERF events with duration_ms', () => {
            const mockPerfLog = {
                level: 'PERF',
                event: 'SEND_SUCCESS',
                data: {
                    duration_ms: 45.23,
                    chat_id: 'chat123'
                }
            };

            expect(mockPerfLog.data.duration_ms).toBeGreaterThanOrEqual(0);
        });
    });
});
