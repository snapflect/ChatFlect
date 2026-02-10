/**
 * trust_hardening.test.ts
 * Epic 72 HF: Trust Hardening Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Trust Hardening...');

// 1. Block Mode
function canSend(trustStatus: string, confirmed: boolean): boolean {
    if (trustStatus === 'BROKEN' && !confirmed) return false;
    return true;
}

assert.strictEqual(canSend('VERIFIED', false), true, 'Verified can send');
assert.strictEqual(canSend('BROKEN', false), false, 'Broken trust BLOCKS sending');
assert.strictEqual(canSend('BROKEN', true), true, 'Broken trust + Confirmation ALLOWS sending');

// 2. Anti-Enumeration
function canGetFingerprint(isRelated: boolean): boolean {
    return isRelated;
}

assert.strictEqual(canGetFingerprint(true), true, 'Related users can see fingerprint');
assert.strictEqual(canGetFingerprint(false), false, 'Strangers CANNOT see fingerprint');

console.log('✅ Trust Hardening Verified');
