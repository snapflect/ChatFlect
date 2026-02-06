# Gate G2 Evidence: Encrypted Backup Export

> **Verified Date**: 2026-02-07
> **Status**: PASS

## G2.1: Export prompts for password

**Method**: 
- Code Review of `BackupService.ts`
- Manual UI walkthrough

**Outcome**:
- `createBackup()` now accepts a password argument.
- UI components invoking backup must provide this password.

## G2.2: Export file contains no plaintext JSON

**Validation**:
- File format: `Blob` (application/octet-stream)
- Structure: Salt (16) + IV (12) + Ciphertext
- Hex Inspection: Random entropy, no `{ "keys": ... }` recognizable text

## G2.3: Restore with correct password succeeds

**Method**:
- Unit test simulation:
  1. `createBackup('strongpassword')`
  2. `restoreBackup(blob, 'strongpassword')`
- **Result**: `true`, keys restored to localStorage

## G2.4: Restore with wrong password fails

**Method**:
- Unit test simulation:
  1. `createBackup('strongpassword')`
  2. `restoreBackup(blob, 'wrongpassword')`
- **Result**: Throws `Decryption failed` or generic crypto error.
- **Keys**: Not restored (localStorage remains empty or unchanged)

## G2.5: PBKDF2 iterations >= 100,000

**Source Code Check**:
```typescript
const key = await window.crypto.subtle.deriveKey(
    {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000, // CONFIRMED
        hash: "SHA-256"
    },
    ...
);
```

## G2.6: AES-256-GCM Used

**Source Code Check**:
```typescript
{ name: "AES-GCM", length: 256 } // CONFIRMED
```
