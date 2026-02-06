# Phase 2 Security Architecture Decisions (TASK 1.5-D) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Classification**: ADR Pack

---

## ADR Index

| ADR ID | Decision | Status |
| :---: | :--- | :---: |
| ADR-001 | Token Storage Strategy | Approved |
| ADR-002 | Key Signing Approach | Approved |
| ADR-003 | Backup Encryption Format | Approved |
| ADR-004 | Device Binding Strategy | Approved |
| ADR-005 | Rate Limiting Architecture | Approved |
| ADR-006 | Firestore Security Model | Approved |
| ADR-007 | Logging & Audit Strategy | Approved |
| ADR-008 | Mobile Secure Storage | Approved |
| ADR-009 | CSRF Protection | Approved |
| ADR-010 | Safety Numbers Implementation | Approved |

---

## ADR-001: Token Storage Strategy

### Decision
Migrate authentication tokens from localStorage to HTTP-Only cookies.

### Context
Phase 1 validation confirmed that all tokens (access_token, refresh_token, id_token) are stored in localStorage and accessible via XSS (T1-S-02).

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. HTTP-Only Cookies** | XSS-proof, automatic sending | Requires CSRF protection, same-site constraints |
| B. Web Crypto API encryption | XSS resistance, no server changes | Key still in JS, complex |
| C. Session storage | Cleared on close | Still XSS accessible |
| D. Service Worker storage | Isolated | Limited browser support |

### Chosen Approach
**Option A: HTTP-Only Cookies**

### Implementation Details
- Backend sets `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api`
- Frontend removes all `localStorage.setItem('*_token')` calls
- Add CSRF token as double-submit cookie
- API interceptor uses `withCredentials: true`

### Risks Introduced
- CSRF attacks if protection not implemented
- Cross-origin API calls require CORS configuration
- Cookie size limits (4KB)

### Future Revision Plan
- Consider signed JWTs in cookies with rotation
- Evaluate SameSite=Lax for OAuth flows

---

## ADR-002: Key Signing Approach

### Decision
Implement device-signed key bundles with Ed25519 signatures.

### Context
E1 threat confirmed that backend key injection is possible because public keys are not authenticated.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Ed25519 Signatures** | Fast, small, secure | Requires new identity key |
| B. X.509 Certificates | Industry standard | Heavy, complex |
| C. Key Transparency Log | Gossip protocol verification | High complexity |
| D. TOFU (Trust on First Use) | Simple | No MITM detection |

### Chosen Approach
**Option A: Ed25519 Signatures**

### Implementation Details
- Device generates Ed25519 identity keypair on first registration
- Signs public key bundle: `sig = sign(identity_priv, hash(device_uuid + public_key))`
- Backend stores `key_signature` with device record
- Client verifies signature on key fetch before encrypting

### Risks Introduced
- Identity key compromise = all signatures trusted
- Key rotation requires re-verification
- Users may ignore warnings

### Future Revision Plan
- Phase 3: Key Transparency Log integration
- Phase 3: Revocation mechanism

---

## ADR-003: Backup Encryption Format

### Decision
Use PBKDF2 key derivation + AES-256-GCM for encrypted backups.

### Context
H2 threat confirmed that backup.service.ts exports private key in plaintext JSON.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. PBKDF2 + AES-256-GCM** | Web Crypto native, proven | Password strength dependent |
| B. Argon2 + AES | Better brute force resistance | Requires library, slower |
| C. SRP-wrapped key | No password transmitted | Complex, overkill |
| D. Device-bound key | No password needed | Can't restore on new device |

### Chosen Approach
**Option A: PBKDF2 + AES-256-GCM**

### Implementation Details
```
salt = crypto.getRandomValues(16 bytes)
key = PBKDF2(password, salt, iterations=100000, hash=SHA-256, length=256)
iv = crypto.getRandomValues(12 bytes)
ciphertext = AES-GCM-encrypt(key, iv, JSON.stringify(backup))
export_blob = salt || iv || ciphertext
```

### Parameters
- PBKDF2 iterations: 100,000 (OWASP recommendation)
- Salt: 16 bytes (128 bits)
- IV: 12 bytes (96 bits, GCM standard)
- Key length: 256 bits

### Risks Introduced
- Weak password = brute-forceable
- Lost password = unrecoverable backup
- Password not enforced strong

### Future Revision Plan
- Add password strength meter
- Consider Argon2id when WebCrypto supports it
- Add recovery key option

---

## ADR-004: Device Binding Strategy

### Decision
Bind tokens to device_uuid and validate on API requests.

### Context
Token replay attacks possible because tokens are not bound to devices.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Device UUID binding** | Simple, effective | UUID can be cloned |
| B. Hardware key binding | Strongest | Requires WebAuthn |
| C. IP binding | Easy | Breaks on network change |
| D. Fingerprint binding | Invisible | Privacy concerns |

### Chosen Approach
**Option A: Device UUID binding**

### Implementation Details
- Include `device_uuid` in JWT claims
- Validate token's `device_uuid` matches request header
- Reject if mismatch (403)

### Risks Introduced
- UUID cloning still possible
- Device migration requires re-auth

### Future Revision Plan
- Phase 3: WebAuthn device attestation
- Detect suspicious device_uuid changes

---

## ADR-005: Rate Limiting Architecture

### Decision
Implement multi-tier rate limiting with IP + User + Endpoint granularity.

### Context
Current rate limiting is basic and doesn't log or differentiate endpoints.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. PHP-based multi-tier** | Simple, works now | Limited scalability |
| B. Redis-based | Fast, distributed | Extra infrastructure |
| C. Cloudflare/WAF | Edge protection | External dependency |
| D. Token bucket in-memory | Fast | Lost on restart |

### Chosen Approach
**Option A: PHP-based multi-tier**

### Implementation Details
- IP-based: 100 requests/minute global
- User-based: 60 requests/minute per user
- Endpoint-based: Specific limits (e.g., OTP: 5/hour)
- Log all rate limit events
- Return Retry-After header

### Risks Introduced
- Not distributed (works per server)
- Database load for tracking

### Future Revision Plan
- Migrate to Redis for scale
- Add adaptive rate limiting
- Integrate with WAF

---

## ADR-006: Firestore Security Model

### Decision
Enforce participant-list-based access control for all chat data.

### Context
Firestore rules need hardening to prevent cross-user access (I1, I2, T3-E-01).

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Participant array check** | Simple, effective | List changes require update |
| B. Subcollection per user | Strong isolation | Complex queries |
| C. Custom claims in token | Fast | Token inflation |
| D. Cloud Function proxy | Full control | Latency |

### Chosen Approach
**Option A: Participant array check**

### Implementation Details
```javascript
match /chats/{chatId}/messages/{msgId} {
  allow read, write: if request.auth != null 
    && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
}
```

### Risks Introduced
- Extra document read per message access
- Large participant lists = performance

### Future Revision Plan
- Cache participant lookup
- Consider custom claims for large groups

---

## ADR-007: Logging & Audit Strategy

### Decision
Implement structured JSON logging with security event taxonomy.

### Context
LOGS-001 confirmed incomplete audit logging coverage.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Structured JSON logs** | Parseable, searchable | Requires format discipline |
| B. Syslog | Standard | Less structured |
| C. ELK Stack | Full featured | Infrastructure overhead |
| D. Cloud Logging | Managed | Vendor lock-in |

### Chosen Approach
**Option A: Structured JSON logs**

### Implementation Details
```json
{
  "timestamp": "ISO8601",
  "level": "INFO|WARN|ERROR",
  "event_type": "AUTH_SUCCESS|DEVICE_REGISTERED|...",
  "user_id": "string",
  "ip": "string",
  "correlation_id": "uuid",
  "details": {}
}
```

### Security Event Types
- `AUTH_SUCCESS`, `AUTH_FAILED`
- `DEVICE_REGISTERED`, `DEVICE_EVICTED`, `DEVICE_REVOKED`
- `KEY_FETCHED`, `KEY_UPDATED`
- `RATE_LIMIT_EXCEEDED`
- `UPLOAD_COMPLETED`
- `SUSPICIOUS_ACTIVITY`

### Risks Introduced
- Log volume management
- PII in logs requires rotation/redaction

### Future Revision Plan
- SIEM integration
- Real-time alerting
- Log anomaly detection

---

## ADR-008: Mobile Secure Storage

### Decision
Use platform-native secure storage (iOS Keychain, Android Keystore) via Capacitor plugin.

### Context
G1 confirmed keys stored in plaintext on mobile devices.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Capacitor SecureStorage** | Cross-platform, native | Plugin dependency |
| B. Native modules only | Maximum control | Platform-specific code |
| C. SQLCipher | Encrypted SQLite | Doesn't use TEE |
| D. Encrypted SharedPreferences | Simple | Android only |

### Chosen Approach
**Option A: Capacitor SecureStorage**

### Implementation Details
- Use `@capacitor/secure-storage` plugin
- Store: `private_key`, `public_key`, `identity_key`
- Migrate from localStorage on app update
- Fallback to encrypted localStorage on web

### Risks Introduced
- Plugin maintenance dependency
- Rooted/jailbroken devices may expose

### Future Revision Plan
- Add biometric gate for key access
- Hardware attestation check

---

## ADR-009: CSRF Protection

### Decision
Implement double-submit cookie pattern for CSRF protection.

### Context
Moving tokens to cookies introduces CSRF risk.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. Double-submit cookie** | Simple, stateless | Cookie visible to JS |
| B. Synchronizer token | Strongest | Server state required |
| C. SameSite=Strict only | Simplest | Breaks some flows |
| D. Origin header check | Fast | Bypassable |

### Chosen Approach
**Option A: Double-submit cookie**

### Implementation Details
- Server sets: `csrf_token` cookie (NOT HttpOnly)
- Client reads cookie, sends in `X-CSRF-Token` header
- Server validates header matches cookie
- Token rotated on sensitive operations

### Risks Introduced
- Subdomain vulnerabilities
- XSS can steal CSRF token (acceptable since HttpOnly protects auth)

### Future Revision Plan
- Signed CSRF tokens
- Per-request tokens for sensitive ops

---

## ADR-010: Safety Numbers Implementation

### Decision
Generate 60-digit numeric safety numbers from public key fingerprints.

### Context
E1 mitigation requires out-of-band key verification mechanism.

### Alternatives Considered

| Option | Pros | Cons |
| :--- | :--- | :--- |
| **A. 60-digit numbers (Signal)** | User friendly, proven | Must match exactly |
| B. Words (BIP39 style) | Memorable | Long for keys |
| C. QR only | Visual | Requires camera |
| D. Emoji grid | Fun | Ambiguous |

### Chosen Approach
**Option A: 60-digit numbers (Signal style)**

### Implementation Details
```
safety_number = SHA256(my_identity_pubkey + their_identity_pubkey)
displayed = first 60 digits of hex-to-decimal conversion
format = "12345 67890 12345 67890 12345 ..."
```

- Display in contact info screen
- Generate QR code for scanning
- Mark contact as "Verified" after confirmation

### Risks Introduced
- User fatigue (may skip verification)
- Key rotation resets verification

### Future Revision Plan
- Automatic verification via secondary channel
- Cloud-based key verification (optional)
