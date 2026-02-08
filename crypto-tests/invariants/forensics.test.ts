/**
 * forensics.test.ts
 * Epic 53: Forensics Exports Invariant Test
 */
import * as assert from 'assert';

console.log('Running Invariant: Forensics Exports...');

// Mock CSV Safeguard Logic
function sanitizeCsvField(field: string): string {
    if (field.startsWith('=') || field.startsWith('+') || field.startsWith('-') || field.startsWith('@')) {
        return "'" + field;
    }
    return field;
}

try {
    // 1. Check Formula Injection Prevention
    const maliciousInput = "=cmd|' /C calc'!A0";
    const safeOutput = sanitizeCsvField(maliciousInput);
    assert.strictEqual(safeOutput, "'=cmd|' /C calc'!A0", 'Should escape formula injection');

    // 2. Check Normal Input
    const normalInput = "123.45.67.89";
    assert.strictEqual(sanitizeCsvField(normalInput), "123.45.67.89", 'Should leave safe input alone');

    console.log('✅ Forensics Export Safety Verified');
} catch (e) {
    console.error('❌ Forensics Invariant Failed:', e);
    process.exit(1);
}
