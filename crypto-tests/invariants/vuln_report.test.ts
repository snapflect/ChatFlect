/**
 * vuln_report.test.ts
 * Epic 57: Invariants for Vulnerability Intake
 */
import * as assert from 'assert';

console.log('Running Invariant: Vulnerability Intake...');

// Mock Manager Logic
class MockVulnManager {
    reports: any[] = [];

    submit(ip: string, title: string) {
        if (title.length < 5) throw new Error("Invalid Title");
        this.reports.push({ id: this.reports.length + 1, status: 'NEW', ip });
    }

    update(id: number, status: string) {
        const r = this.reports.find(x => x.id === id);
        if (r) r.status = status;
    }
}

try {
    const mgr = new MockVulnManager();

    // 1. Submission
    mgr.submit('127.0.0.1', 'SQL Injection in Login');
    assert.strictEqual(mgr.reports.length, 1);
    assert.strictEqual(mgr.reports[0].status, 'NEW');

    // 2. Validation
    assert.throws(() => {
        mgr.submit('1.2.3.4', 'Hi'); // Too short
    }, /Invalid Title/);

    // 3. Lifecycle
    mgr.update(1, 'TRIAGED');
    assert.strictEqual(mgr.reports[0].status, 'TRIAGED');

    console.log('✅ Vuln Report Logic Verified');
} catch (e) {
    console.error('❌ Vuln Report Invariant Failed:', e);
    process.exit(1);
}
