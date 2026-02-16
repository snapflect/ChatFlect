import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    scenarios: {
        pull_burst: {
            executor: 'constant-arrival-rate',
            rate: 50, // 50 pulls per second
            timeUnit: '1s',
            duration: '30s',
            preAllocatedVUs: 10,
            maxVUs: 50,
        },
        broadcast_fanout: {
            executor: 'per-vu-iterations',
            vus: 5,
            iterations: 10,
            startTime: '35s',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    },
};

const BASE_URL = 'http://localhost/secure-chat-backend/api/v4';

export default function () {
    // Scenario 1: Inbox Pull
    const pullParams = {
        headers: {
            'Authorization': 'Bearer BENCHMARK_TOKEN_001',
            'X-Mock-User': 'BENCH_USER_001', // Assumes auth bypass for bench
        },
    };
    let res = http.get(`${BASE_URL}/messages/pull.php`, pullParams);
    check(res, { 'pull status is 200': (r) => r.status === 200 });

    sleep(0.5);
}

export function broadcast_fanout() {
    // Scenario 2: Broadcast Send
    const payload = JSON.stringify({
        list_id: 'PASTE_LIST_ID_HERE',
        content: 'Benchmark Broadcast Content',
    });
    const params = {
        headers: {
            'Authorization': 'Bearer BENCHMARK_TOKEN_001',
            'Content-Type': 'application/json',
        },
    };
    let res = http.post(`${BASE_URL}/broadcast/send.php`, payload, params);
    check(res, { 'broadcast status is 200': (r) => r.status === 200 });
}
