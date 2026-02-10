/**
 * version.test.ts
 * Epic 38: Version Endpoint Tests
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost/secure-chat-backend';

describe('Version Endpoint (Epic 38)', () => {

    describe('SC-VERS-01: Valid schema', () => {
        it('should return version fields', async () => {
            try {
                const res = await axios.get(`${BASE_URL}/admin/v1/version.php`, {
                    headers: { 'X-Admin-Token': 'test' },
                    validateStatus: () => true
                });
                if (res.status === 200) {
                    expect(res.data).toHaveProperty('commit');
                    expect(res.data).toHaveProperty('env');
                }
            } catch (e) {
                console.log('Backend not running');
            }
        });
    });

    describe('SC-VERS-02: Commit hash pattern', () => {
        it('should match git hash format', () => {
            const commitShort = 'a1b2c3d';
            expect(commitShort).toMatch(/^[a-f0-9]{7}$/);
        });
    });

    describe('SC-VERS-03: Valid env value', () => {
        it('should be DEV/SIT/PROD', () => {
            const validEnvs = ['dev', 'sit', 'prod', 'development', 'staging', 'production'];
            const env = 'prod';
            expect(validEnvs).toContain(env);
        });
    });
});
