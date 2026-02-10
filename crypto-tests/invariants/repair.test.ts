/**
 * repair.test.ts
 * Epic 49: Multi-Device Sync & Repair Invariants
 */

class MockRepairDB {
    private inbox: any[] = [];

    insert(deviceId: string, msg: string) {
        this.inbox.push({ id: this.inbox.length + 1, deviceId, msg, status: 'PENDING' });
    }

    sync(deviceId: string, lastId: number) {
        return this.inbox.filter(m => m.deviceId === deviceId && m.id > lastId);
    }
}

describe('Invariant: Sync & Repair', () => {

    it('should recover missed messages via sync', () => {
        const db = new MockRepairDB();
        db.insert('devA', 'msg-1'); // id 1
        db.insert('devA', 'msg-2'); // id 2
        db.insert('devA', 'msg-3'); // id 3

        // Device A only has up to msg-1. Sync requests > 1.
        const recovered = db.sync('devA', 1);

        expect(recovered.length).toBe(2);
        expect(recovered[0].msg).toBe('msg-2');
        expect(recovered[1].msg).toBe('msg-3');
    });

    it('should verify monotonicity of sync', () => {
        const db = new MockRepairDB();
        db.insert('devA', 'msg-1');

        // Sync 0 -> gets 1
        let recovered = db.sync('devA', 0);
        expect(recovered[0].id).toBe(1);

        // Sync 1 -> gets empty
        recovered = db.sync('devA', 1);
        expect(recovered.length).toBe(0);
    });
});
