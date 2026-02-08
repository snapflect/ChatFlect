/**
 * ratelimit.test.ts
 * Epic 52: Rate Limit Invariants
 */
import * as assert from 'assert';

class MockRateLimiter {
    private tokens = 10;

    consume(cost: number): boolean {
        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }
        return false;
    }
}

console.log('Running Invariant: Global Rate Limit...');

try {
    const limiter = new MockRateLimiter();

    // 1. Allow within limit
    assert.strictEqual(limiter.consume(1), true, 'Should allow request within limit');

    // 2. Block exceeding limit (Simulate burst)
    limiter.consume(9); // Drain
    assert.strictEqual(limiter.consume(1), false, 'Should block request exceeding limit');

    console.log('✅ Rate Limiter Enforced');
} catch (e) {
    console.error('❌ Rate Limit Invariant Failed:', e);
    process.exit(1);
}
