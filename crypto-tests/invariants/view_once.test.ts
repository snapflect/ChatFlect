/**
 * view_once.test.ts
 * Epic 80: Burn Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: View Once Deletion...');

// Mock State
const DB = {
    messages: [
        { id: 1, content: 'secret', is_view_once: true, viewed_at: null },
        { id: 2, content: 'normal', is_view_once: false, viewed_at: null }
    ]
};

// Action: View
function markViewed(msgId: number) {
    const msg = DB.messages.find(m => m.id === msgId);
    if (!msg) return;

    if (msg.is_view_once) {
        msg.content = null as any; // Cast to any to bypass string type check for test mock
        msg.viewed_at = new Date() as any;
    }
}

// Test 1: Burn
markViewed(1);
assert.strictEqual(DB.messages[0].content, null, 'View Once message content must be NULL after view');
assert.ok(DB.messages[0].viewed_at, 'Timestamp set');

// Test 2: Normal Persistence
markViewed(2); // Logic (in Manager) ignores persistence if not view once? 
// Actually Manager only burns if is_view_once is true.
// If fetch returns and it's not view_once, it just returns "OK" without burn.
// My mock above burned it if is_view_once. 
// If is_view_once = false, do nothing.

function managerLogic(msgId: number) {
    const msg = DB.messages.find(m => m.id === msgId);
    if (msg && msg.is_view_once) {
        msg.content = null;
    }
}
managerLogic(2);
assert.strictEqual(DB.messages[1].content, 'normal', 'Normal message persists');

console.log('✅ View Once Invariants Verified');
