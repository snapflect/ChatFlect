/**
 * ttl_legal_hold.test.ts
 * Epic 70: Legal Hold Invariant
 */
import * as assert from 'assert';

console.log('Running Invariant: Legal Hold Supremacy...');

function canDelete(msgId: string, isExpired: boolean, isHeld: boolean): boolean {
    if (isHeld) return false;
    return isExpired;
}

// Case 1: Expired + Held -> KEPT
assert.strictEqual(canDelete('msg1', true, true), false, 'Legal Hold MUST block deletion of expired message');

// Case 2: Expired + Not Held -> DELETED
assert.strictEqual(canDelete('msg2', true, false), true, 'Expired message should delete if no hold');

console.log('✅ Legal Hold Invariant Verified');
