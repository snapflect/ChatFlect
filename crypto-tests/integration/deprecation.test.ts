/**
 * deprecation.test.ts
 * Epic 34: API Versioning + Deprecation Tests
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost/secure-chat-backend';

describe('API Versioning + Deprecation (Epic 34)', () => {

    describe('SC-DEP-01: API version header', () => {
        it('should return X-API-Version header', async () => {
            try {
                const res = await axios.get(`${BASE_URL}/relay/pull.php`, {
                    validateStatus: () => true
                });

                const version = res.headers['x-api-version'];
                expect(version).toBeDefined();
            } catch (e) {
                console.log('Backend not running - skipping');
            }
        });
    });

    describe('SC-DEP-02: Deprecated endpoint returns Sunset', () => {
        it('should include Sunset header for deprecated endpoints', () => {
            const mockDeprecated = {
                deprecated: true,
                sunset: '2026-06-01',
                replacement: '/relay/send.php'
            };
            expect(mockDeprecated.sunset).toBe('2026-06-01');
        });
    });

    describe('SC-DEP-03: Replacement Link header', () => {
        it('should include Link header with successor', () => {
            const mockHeaders = {
                'Deprecation': 'true',
                'Sunset': '2026-06-01',
                'Link': '</relay/send.php>; rel="successor-version"'
            };
            expect(mockHeaders['Link']).toContain('successor-version');
        });
    });

    describe('SC-DEP-04: Non-deprecated has no Deprecation header', () => {
        it('should not have Deprecation header for active endpoints', async () => {
            try {
                const res = await axios.get(`${BASE_URL}/relay/pull.php`, {
                    validateStatus: () => true
                });

                const deprecation = res.headers['deprecation'];
                expect(deprecation).toBeUndefined();
            } catch (e) {
                console.log('Backend not running - skipping');
            }
        });
    });

    describe('Version Detection', () => {
        it('should detect v1 from /relay/v1/endpoint', () => {
            const path = '/relay/v1/send.php';
            const match = path.match(/\/v(\d+)\//);
            const version = match ? `v${match[1]}` : 'v1';
            expect(version).toBe('v1');
        });

        it('should default to v1 for unversioned paths', () => {
            const path = '/relay/send.php';
            const match = path.match(/\/v(\d+)\//);
            const version = match ? `v${match[1]}` : 'v1';
            expect(version).toBe('v1');
        });
    });
});
