/**
 * inbox_ownership.test.ts
 * Epic 48-HF: Invariant - Inbox Ownership & Hardening
 */

// Mock Database wrapper
class MockInboxDB {
    private inbox: any[] = []; // { id, recipientId, msgUuid, status }

    insert(recipientId: string, msgUuid: string) {
        // Constraint: Unique (recipientId, msgUuid)
        if (this.inbox.find(m => m.recipientId === recipientId && m.msgUuid === msgUuid)) {
            throw new Error('DUPLICATE_ENTRY');
        }
        this.inbox.push({ id: Math.random(), recipientId, msgUuid, status: 'PENDING' });
    }

    pull(authDeviceId: string) {
        // Enforce: ONLY fetch rows where recipientId == authDeviceId
        return this.inbox.filter(m => m.recipientId === authDeviceId);
    }

    ack(authDeviceId: string, msgId: number, status: string) {
        // Enforce: ONLY update rows where recipientId == authDeviceId
        const msg = this.inbox.find(m => m.id === msgId);
        if (msg && msg.recipientId === authDeviceId) {
            msg.status = status;
            return true;
        }
        return false;
    }
}

describe('Invariant: Inbox Ownership & Hardening', () => {

    // HF-48.1: Replay Prevention
    it('should reject duplicate inserts (DB Constraint)', () => {
        const db = new MockInboxDB();
        db.insert('dev1', 'msg-A');
        expect(() => db.insert('dev1', 'msg-A')).toThrow('DUPLICATE_ENTRY');
    });

    // HF-48.2: Ack Ownership
    it('should prevent ACKing another device messages', () => {
        const db = new MockInboxDB();
        db.insert('victim-device', 'msg-B');
        const victimMsg = db.pull('victim-device')[0];

        // Attacker attempts to ACK
        const success = db.ack('attacker-device', victimMsg.id, 'READ');
        expect(success).toBe(false);
    });

    // HF-48.3: Pull Isolation
    it('should strictly isolate pull queues', () => {
        const db = new MockInboxDB();
        db.insert('devA', 'secret-A');
        db.insert('devB', 'secret-B');

        const inboxA = db.pull('devA');
        expect(inboxA.length).toBe(1);
        expect(inboxA[0].msgUuid).toBe('secret-A');

        const inboxB = db.pull('devB');
        expect(inboxB.length).toBe(1);
        expect(inboxB[0].msgUuid).toBe('secret-B');
    });

});
