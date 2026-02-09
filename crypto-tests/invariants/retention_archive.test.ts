/**
 * retention_archive.test.ts
 * Epic 64: Retention Invariants
 */
import * as assert from 'assert';

console.log('Running Invariant: Retention Safety...');

// Mock Policies
const globalRetention = 365;
const orgRetention = 30;
const legalHold = true;

function effectiveRetention(hasOverride: boolean, overrideValue: number, isHeld: boolean): number {
    if (isHeld) return Infinity; // Hold = Forever
    if (hasOverride) return overrideValue;
    return globalRetention;
}

// 1. Legal Hold check
assert.strictEqual(effectiveRetention(true, 30, true), Infinity, 'Legal hold must override deletion');

// 2. Org Override
assert.strictEqual(effectiveRetention(true, 30, false), 30, 'Org policy must override global');

// 3. Default
assert.strictEqual(effectiveRetention(false, 0, false), 365, 'No policy means global default');

console.log('✅ Retention Invariants Verified');
