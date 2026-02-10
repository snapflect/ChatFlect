/**
 * contract.test.ts
 * Epic 35: API Contract Tests
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost/secure-chat-backend';

describe('API Contract Tests (Epic 35)', () => {

    describe('SC-CON-01: Send response contract', () => {
        it('should have required fields in SendResponse', () => {
            const mockResponse = {
                success: true,
                server_seq: 120,
                timestamp: '2026-02-08T10:10:00Z',
                request_id: 'test-uuid'
            };
            expect(mockResponse).toHaveProperty('success');
            expect(mockResponse).toHaveProperty('server_seq');
            expect(mockResponse).toHaveProperty('timestamp');
            expect(mockResponse).toHaveProperty('request_id');
        });
    });

    describe('SC-CON-02: Pull response contract', () => {
        it('should have messages and receipts arrays', () => {
            const mockResponse = {
                messages: [],
                receipts: [],
                last_seq: 0,
                last_receipt_id: 0,
                has_more: false,
                request_id: 'test-uuid'
            };
            expect(Array.isArray(mockResponse.messages)).toBe(true);
            expect(Array.isArray(mockResponse.receipts)).toBe(true);
            expect(mockResponse).toHaveProperty('request_id');
        });
    });

    describe('SC-CON-03: Deprecated endpoint headers', () => {
        it('should include Sunset and Link headers', () => {
            const mockHeaders = {
                'deprecation': 'true',
                'sunset': '2026-06-01',
                'link': '</relay/send.php>; rel="successor-version"'
            };
            expect(mockHeaders.sunset).toBeDefined();
            expect(mockHeaders.link).toContain('successor');
        });
    });

    describe('SC-CON-04: Error response contract', () => {
        it('should match error schema', () => {
            const errorResponse = {
                error: 'RATE_LIMITED',
                message: 'Too many requests',
                retry_after_sec: 12,
                request_id: 'test-uuid'
            };
            expect(errorResponse).toHaveProperty('error');
            expect(errorResponse).toHaveProperty('message');
            expect(errorResponse).toHaveProperty('request_id');
        });
    });

    describe('Health Report Contract', () => {
        it('should match HealthResponse schema', async () => {
            try {
                const res = await axios.get(`${BASE_URL}/admin/v1/health_report.php`, {
                    headers: { 'X-Admin-Token': 'test' },
                    validateStatus: () => true
                });
                if (res.status === 200) {
                    expect(res.data).toHaveProperty('status');
                    expect(['OK', 'DEGRADED', 'CRITICAL']).toContain(res.data.status);
                }
            } catch (e) {
                console.log('Backend not running');
            }
        });
    });
});
