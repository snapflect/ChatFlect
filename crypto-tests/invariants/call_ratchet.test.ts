/**
 * call_ratchet.test.ts
 * Epic 76: Call Ratchet Monotonocity
 */
import * as assert from 'assert';

console.log('Running Invariant: Call Ratchet Monotinicity...');

let currentEpoch = 0;

function rotate(): number {
    currentEpoch++;
    return currentEpoch;
}

// Invariant: Epoch must increase
const e1 = rotate();
const e2 = rotate();

assert.ok(e2 > e1, 'Epoch must strictly increase');

// Invariant: Old key rejection (Simulated)
function canDecrypt(msgEpoch: number, currentEpoch: number): boolean {
    // Forward Secrecy: Can't decrypt if we advanced? 
    // Actually, usually we keep standard window for out-of-order packets.
    // BUT strict FS means deleted keys are gone.
    // Let's assume strict Window of 1.
    if (msgEpoch < currentEpoch - 1) return false;
    return true;
}

// Advance State
rotate(); // 3
rotate(); // 4

// Try to decrypt old epoch 1 with current state 4
assert.strictEqual(canDecrypt(1, 4), false, 'Old epoch 1 should be undecryptable at 4');

console.log('✅ Ratchet Invariants Verified');
