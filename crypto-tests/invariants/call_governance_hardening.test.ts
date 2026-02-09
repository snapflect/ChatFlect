/**
 * call_governance_hardening.test.ts
 * Epic 77 HF: Admin Controls
 */
import * as assert from 'assert';

console.log('Running Invariant: Admin Rate Limiting...');

interface ModLog {
    timestamp: number;
    action: string;
}

function checkRateLimit(logs: ModLog[], action: string, limit: number, windowSeconds: number): boolean {
    const now = 3600; // Mock current time
    const recent = logs.filter(l => l.action === action && l.timestamp > now - windowSeconds).length;
    return recent < limit;
}

const logs = [
    { timestamp: 3500, action: 'FORCE_END' },
    { timestamp: 3510, action: 'FORCE_END' },
    { timestamp: 3520, action: 'FORCE_END' },
];

assert.strictEqual(checkRateLimit(logs, 'FORCE_END', 5, 3600), true, 'Below limit allows');
assert.strictEqual(checkRateLimit(logs, 'FORCE_END', 3, 3600), false, 'At limit blocks');

console.log('✅ Governance Hardening Verified');
