import http from 'k6/http';
import { check, sleep } from 'k6';

// Epic 100: Autoscale Trigger
// Objective: Spike CPU to > 80% to force HPA scale-up

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TARGET_VUS = __ENV.TARGET_VUS ? parseInt(__ENV.TARGET_VUS) : 500;
const DURATION = __ENV.DURATION || '3m';

// Safety Guard
if (BASE_URL.includes('production') || BASE_URL.includes('chatflect.com')) {
    if (__ENV.FORCE_PRODUCTION !== 'true') {
        throw new Error("❌ CRITICAL: Load test targeting PRODUCTION without FORCE_PRODUCTION=true is forbidden!");
    }
}

export const options = {
    stages: [
        { duration: '1m', target: Math.floor(TARGET_VUS / 10) },  // Warm up
        { duration: DURATION, target: TARGET_VUS }, // Spike to Target
        { duration: '5m', target: TARGET_VUS }, // Sustain
        { duration: '1m', target: 0 },   // Cooldown
    ],

    export default function() {
        // Hit status endpoint (lightweight but high volume)
        const res = http.get(`${BASE_URL}/api/status.php`);

        check(res, {
            'status is 200': (r) => r.status === 200,
            'protocol is HTTP/1.1': (r) => r.proto === 'HTTP/1.1',
        });

        // Simulate aggressive retry behavior (low sleep)
        sleep(0.1);
    }
