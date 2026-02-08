/**
 * no_plaintext_logging.js
 * Epic 50 HF: Audit - Ensure sensitive data is not logged
 * Standalone invariant test (runnable via node)
 */

const assert = require('assert');

console.log('Running Invariant: No Plaintext Logging...');

const FORBIDDEN_PATTERNS = [
    /BEGIN PRIVATE KEY/,
    /session_key|root_key|chain_key/,
    /"sk":\s*"[a-zA-Z0-9+/=]{40,}"/, // JSON key dump
    /Authorization:\s*Bearer\s+[a-zA-Z0-9._-]+/ // Full tokens
];

function checkLog(log) {
    for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(log)) {
            return true;
        }
    }
    return false;
}

try {
    // Test 1: Should catch sensitive data
    const mockLog = 'Error: Failed to save session {"sk": "A1B2C3D4A1B2C3D4A1B2C3D4A1B2C3D4A1B2C3D4"}';
    assert.strictEqual(checkLog(mockLog), true, 'Failed to catch sensitive key dump');
    console.log('✅ Caught sensitive data correctly');

    // Test 2: Should pass safe logs
    const safeLog = 'Error: Connection Timeout at 12:00';
    assert.strictEqual(checkLog(safeLog), false, 'False positive on safe log');
    console.log('✅ Ignored safe log correctly');

    console.log('🎉 Audit Invariant Passed');
} catch (e) {
    console.error('❌ Invariant Failed:', e);
    process.exit(1);
}
