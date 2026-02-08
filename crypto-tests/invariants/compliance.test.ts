/**
 * compliance.test.ts
 * Epic 54: Compliance & Retention Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Compliance Governance...');

class MockComplianceManager {
    private holds = new Set<string>();

    addHold(id: string) { this.holds.add(id); }

    canDelete(id: string): boolean {
        return !this.holds.has(id);
    }
}

try {
    const manager = new MockComplianceManager();
    const userId = "user_123";

    // 1. Standard Deletion (No Hold)
    assert.strictEqual(manager.canDelete(userId), true, 'Should allow delete when no hold active');

    // 2. Legal Hold Active
    manager.addHold(userId);
    assert.strictEqual(manager.canDelete(userId), false, 'Should BLOCK delete when Legal Hold active');

    console.log('✅ Compliance Invariants Verified');
} catch (e) {
    console.error('❌ Compliance Invariant Failed:', e);
    process.exit(1);
}
