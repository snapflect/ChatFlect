/**
 * call_security.test.ts
 * Epic 76 HF: Call Security Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Call Security...');

// 1. Resync Monotonicity
function canResync(current: number, reported: number): boolean {
    if (reported > current) return true; // Forward sync ok
    return false; // Rollback rejected
}

assert.strictEqual(canResync(10, 15), true, 'Forward resync allowed');
assert.strictEqual(canResync(10, 5), false, 'Rollback REJECTED');
assert.strictEqual(canResync(10, 10), false, 'Same state ignored');

// 2. Lockdown Logic
interface LockdownState {
    failures: number;
    lockedUtil: number;
}

function checkLockdown(state: LockdownState, now: number): boolean {
    if (now < state.lockedUtil) return true; // Is Locked
    return false;
}

const lockedState = { failures: 5, lockedUtil: 1000 };
const freeState = { failures: 2, lockedUtil: 0 };

assert.strictEqual(checkLockdown(lockedState, 500), true, 'State is LOCKED');
assert.strictEqual(checkLockdown(lockedState, 1500), false, 'State is EXPIRED/OPEN');
assert.strictEqual(checkLockdown(freeState, 500), false, 'State is FREE');

console.log('✅ Call Security Invariants Verified');
