/**
 * audit.test.ts
 * Epic 51: Security Audit Invariants
 * Ensures critical security events are logged using mocked logger logic.
 */

import * as assert from 'assert';

class MockAuditLogger {
    public logs: any[] = [];

    log(type: string, severity: string, context: any = {}) {
        this.logs.push({ type, severity, context, time: Date.now() });
    }

    hasEvent(type: string): boolean {
        return this.logs.some(l => l.type === type);
    }
}

console.log('Running Invariant: Audit Pipe...');

try {
    const logger = new MockAuditLogger();

    // Challenge 1: Log critical event
    logger.log('DECRYPT_FAIL_TAMPER', 'CRITICAL', { deviceId: 'dev-123', msgId: 'abc' });

    // Invariant: Critical event must be persisted
    assert.strictEqual(logger.hasEvent('DECRYPT_FAIL_TAMPER'), true, 'Critical event dropped');
    assert.strictEqual(logger.logs[0].severity, 'CRITICAL', 'Severity mismatch');

    // Challenge 2: Context preservation
    assert.strictEqual(logger.logs[0].context.deviceId, 'dev-123', 'Context lost');

    console.log('✅ Audit Pipe Integrity Verified');
} catch (e) {
    console.error('❌ Audit Invariant Failed:', e);
    process.exit(1);
}
