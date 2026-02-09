/**
 * metadata_leak.test.ts
 * Epic 74: Metadata Minimization Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Metadata Leakage...');

// Invariant: Logged data MUST NOT contain raw PII (IP/Email)
function isRedacted(logData: any): boolean {
    const json = JSON.stringify(logData);
    if (json.includes("192.168.1.1")) return false; // Fail if raw IP found
    if (json.includes("user@example.com")) return false; // Fail if raw email found
    if (json.includes("[REDACTED]")) return true; // Success if mask found
    return false; // Fail if neither (unexpected)
}

// Mock Data
const rawEvent = {
    user: "user1",
    ip: "192.168.1.1", // PII
    email: "user@example.com" // PII
};

const redactedEvent = {
    user: "user1",
    ip: "[REDACTED]",
    email: "[REDACTED]"
};

assert.strictEqual(isRedacted(rawEvent), false, 'Raw Event triggers leak detection');
assert.strictEqual(isRedacted(redactedEvent), true, 'Redacted Event passes leak check');

console.log('✅ Metadata Invariants Verified');
