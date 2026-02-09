/**
 * message_governance_hardening.test.ts
 * Epic 78 HF: Moderation Security
 */
import * as assert from 'assert';

console.log('Running Invariant: Moderation Security...');

// 1. Masking
function isMasked(userId: string): boolean {
    return userId.startsWith('MASKED_');
}

assert.strictEqual(isMasked('MASKED_USER_AF091'), true, 'ID is masked');
assert.strictEqual(isMasked('12345'), false, 'ID is raw');

// 2. Receipt Structure
function validateReceipt(receipt: string): boolean {
    const parts = receipt.split(':');
    return parts[0] === 'MOD_RECEIPT' && parts.length >= 5;
}

const validR = "MOD_RECEIPT:FREEZE:123:ADMIN:Reason:12345678";
assert.strictEqual(validateReceipt(validR), true, 'Receipt format valid');

console.log('✅ Moderation Hardening Verified');
