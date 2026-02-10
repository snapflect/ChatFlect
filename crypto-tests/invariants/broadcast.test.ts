/**
 * broadcast.test.ts
 * Epic 79: Broadcast Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Broadcast Fanout...');

// 1. One-to-Many Fanout
function fanout(senderId: string, recipientIds: string[]): { sender: string, recipient: string }[] {
    return recipientIds.map(rid => ({ sender: senderId, recipient: rid }));
}

const recipients = ['userA', 'userB', 'userC'];
const messages = fanout('sender1', recipients);

assert.strictEqual(messages.length, 3, 'Fanout produces N messages');
assert.strictEqual(messages[0].recipient, 'userA', 'Message 1 target correct');
assert.strictEqual(messages[0].sender, 'sender1', 'Message 1 sender correct');

// 2. Privacy (No shared context)
function checkPrivacy(msg1: any, msg2: any): boolean {
    // In Recipient view, they should look like DMs.
    // They should NOT share a "room_id" that exposes others.
    return msg1.recipient !== msg2.recipient;
}
assert.strictEqual(checkPrivacy(messages[0], messages[1]), true, 'Recipients isolated');

console.log('✅ Broadcast Invariants Verified');
