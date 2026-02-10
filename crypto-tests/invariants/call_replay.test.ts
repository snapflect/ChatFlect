/**
 * call_replay.test.ts
 * Epic 76: Call Replay Protection
 */
import * as assert from 'assert';

console.log('Running Invariant: Call Replay Protection...');

const seenPackets = new Set<string>();

function receivePacket(sender: string, epoch: number, seq: number): boolean {
    const packetId = `${sender}:${epoch}:${seq}`;
    if (seenPackets.has(packetId)) return false; // Replay Detected
    seenPackets.add(packetId);
    return true;
}

// Packet 1
assert.strictEqual(receivePacket('alice', 1, 100), true, 'First Packet Accepted');

// Packet 2 (New Seq)
assert.strictEqual(receivePacket('alice', 1, 101), true, 'Sequence Advance Accepted');

// Replay Packet 1
assert.strictEqual(receivePacket('alice', 1, 100), false, 'Replay REJECTED');

console.log('✅ Replay Invariants Verified');
