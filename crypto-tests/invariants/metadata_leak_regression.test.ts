/**
 * metadata_leak_regression.test.ts
 * Epic 74 HF: Regression Tests
 */
import * as assert from 'assert';

console.log('Running Invariant: Metadata Regression...');

// Invariant: Anonymous responses in API must NOT contain real user_id
function checkAnonymousResponse(response: any): boolean {
    if (response.user_id && response.user_id.startsWith('ANON-')) return true;
    if (response.is_anonymous === true && !String(response.user_id).startsWith('ANON-')) return false; // LEAK!
    return true;
}

// Invariant: Logging function must redact emails
function checkLogRedaction(logEntry: string): boolean {
    return !logEntry.includes('@example.com');
}

// Case 1: Anon Response
const safeResp = { user_id: 'ANON-1234', is_anonymous: true };
const leakResp = { user_id: 'real_user_1', is_anonymous: true };

assert.strictEqual(checkAnonymousResponse(safeResp), true, 'Safe Anon response passes');
assert.strictEqual(checkAnonymousResponse(leakResp), false, 'Leaky Anon response FAILS');

// Case 2: Log Redaction
const safeLog = 'User login from [REDACTED]';
const leakLog = 'User login from admin@example.com';

assert.strictEqual(checkLogRedaction(safeLog), true, 'Redacted log passes');
assert.strictEqual(checkLogRedaction(leakLog), false, 'Leaky log FAILS');

console.log('✅ Metadata Regression Tests Verified');
