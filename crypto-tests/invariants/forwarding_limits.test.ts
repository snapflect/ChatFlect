/**
 * forwarding_limits.test.ts
 * Epic 84: Forwarding Limits Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Forwarding Limits...');

// Mock Guard
class ForwardingGuard {
    checkLimit(sourceScore: number, count: number) {
        if (count > 5) throw new Error("MAX_LIMIT");
        if (sourceScore >= 5 && count > 1) throw new Error("FREQUENT_LIMIT");
    }
}
const guard = new ForwardingGuard();

// Case A: Fresh Message (Score 0) -> 5 OK
try {
    guard.checkLimit(0, 5);
    console.log('✅ Fresh Message -> 5 Recipients Allowed');
} catch (e) {
    console.error('❌ Fresh Message Blocked Unexpectedly');
}

// Case B: Fresh Message -> 6 Blocked
try {
    guard.checkLimit(0, 6);
    console.error('❌ Global Limit Bypassed');
} catch (e: any) {
    assert.strictEqual(e.message, "MAX_LIMIT");
    console.log('✅ Global Limit Enforced (Max 5)');
}

// Case C: Frequent (Score 5) -> 2 Blocked
try {
    guard.checkLimit(5, 2);
    console.error('❌ Frequent Limit Bypassed');
} catch (e: any) {
    assert.strictEqual(e.message, "FREQUENT_LIMIT");
    console.log('✅ Frequent Limit Enforced (Max 1)');
}

// Case D: Frequent (Score 5) -> 1 OK
try {
    guard.checkLimit(5, 1);
    console.log('✅ Frequent Message -> 1 Recipient Allowed');
} catch (e) {
    console.error('❌ Frequent Message Blocked Unexpectedly');
}
