import http from 'k6/http';
import { check, sleep } from 'k6';

// Epic 100: Soak Test
// Objective: Detect Memory Leaks over time

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Safety Guard
if (BASE_URL.includes('production') || BASE_URL.includes('chatflect.com')) {
    if (__ENV.FORCE_PRODUCTION !== 'true') {
        throw new Error("❌ CRITICAL: Load test targeting PRODUCTION without FORCE_PRODUCTION=true is forbidden!");
    }
}

export const options = {
    stages: [
        { duration: '2m', target: __ENV.TARGET_VUS || 100 },  // Ramp up
        { duration: __ENV.DURATION || '10m', target: __ENV.TARGET_VUS || 100 }, // Hold
        { duration: '2m', target: 0 },    // Ramp down
    ],

    export default function() {
        // Simulate standard user behavior
        const payload = JSON.stringify({
            content: "Soak test message content for memory analysis",
            recipient_id: "user_123"
        });

        const params = {
            headers: {
                'Content-Type': 'application/json',
                'X-Metrics-Token': 'test_token' // Simulated Auth
            },
        };

        const res = http.post(`${BASE_URL}/api/v4/messages/send.php`, payload, params);

        // We expect 401/403 if not really auth'd, but we care about memory/stability logic execution
        check(res, {
            'response received': (r) => r.status !== 0,
        });

        sleep(1);
    }
