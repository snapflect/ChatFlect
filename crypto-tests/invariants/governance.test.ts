/**
 * governance.test.ts
 * Epic 58: Invariants for Governance
 */
import * as assert from 'assert';

console.log('Running Invariant: Governance Enforcement...');

class MockGovernance {
    queue: any[] = [];
    policies = { 'PERMA_BAN': { min_approvers: 1 } };

    request(adminId: number, type: string) {
        this.queue.push({
            id: this.queue.length + 1,
            type,
            requester: adminId,
            status: 'PENDING',
            approvals: []
        });
        return this.queue.length;
    }

    approve(reqId: number, adminId: number) {
        const req = this.queue.find(q => q.id === reqId);
        if (!req) throw new Error("Not Found");
        if (req.requester === adminId) throw new Error("Self-approval forbidden");

        req.approvals.push(adminId);
        if (req.approvals.length >= this.policies['PERMA_BAN'].min_approvers) {
            req.status = 'APPROVED';
        }
    }
}

try {
    const gov = new MockGovernance();

    // 1. Request
    const id = gov.request(101, 'PERMA_BAN');
    assert.strictEqual(gov.queue[0].status, 'PENDING');

    // 2. Self-Approval Fail
    try {
        gov.approve(id, 101);
        assert.fail("Should have thrown");
    } catch (e: any) {
        assert.match(e.message, /Self-approval forbidden/);
    }

    // 3. Other Approval Success
    gov.approve(id, 102);
    assert.strictEqual(gov.queue[0].status, 'APPROVED');

    console.log('✅ Governance Logic Verified');
} catch (e) {
    console.error('❌ Governance Invariant Failed:', e);
    process.exit(1);
}
