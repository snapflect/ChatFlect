/**
 * message_policy.test.ts
 * Epic 78: Messaging Policy
 */
import * as assert from 'assert';

console.log('Running Invariant: Message Policy...');

interface MsgPolicy {
    allowMedia: boolean;
    allowForwarding: boolean;
}

function canSend(policy: MsgPolicy, hasMedia: boolean): boolean {
    if (hasMedia && !policy.allowMedia) return false;
    return true;
}

const strict = { allowMedia: false, allowForwarding: false };
const open = { allowMedia: true, allowForwarding: true };

assert.strictEqual(canSend(strict, true), false, 'Strict Blocks Media');
assert.strictEqual(canSend(open, true), true, 'Open Allows Media');

console.log('✅ Message Policy Invariants Verified');
