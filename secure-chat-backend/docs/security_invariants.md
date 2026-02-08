# ChatFlect Security Invariants
**Epic 46: Non-Negotiable Security Rules**

These invariants MUST hold across all ChatFlect platforms.
Any violation is a release blocker. CI tests enforce these rules.

---

## Invariant 1: No Plaintext Persistence
> **Rule**: No plaintext message may ever be written to disk, local DB, logs, or crash reports.
> **Enforcement**: Code reviews, static analysis, encrypted storage wrappers.

---

## Invariant 2: Tamper Detection
> **Rule**: Any modification to ciphertext must cause decryption failure. No partial reads.
> **Enforcement**: AEAD (Authenticated Encryption) checks in all crypto wrappers.

---

## Invariant 3: Replay Protection
> **Rule**: The same message payload must never be accepted twice.
> **Enforcement**: Nonce tracking, Message UUID deduplication.

---

## Invariant 4: Session Key Separation
> **Rule**: Session keys must be unique per device pair.
> **Enforcement**: Unique session IDs, strict key derivation contexts.

---

## Invariant 5: Key Change Warning
> **Rule**: If a contact’s identity key changes, the user must be warned. Messages are untrusted until verified.
> **Enforcement**: Identity Key store checks on every handshake.

---

## Invariant 6: Deterministic Crypto Outputs
> **Rule**: Given identical inputs (keys, nonce, plaintext), encryption must produce expected structural format.
> **Enforcement**: Automated structure tests.

---

## Invariant 7: Secure Randomness
> **Rule**: All key generation must use cryptographically secure RNG.
> **Enforcement**: `crypto.getRandomValues` (Web), `SecureRandom` (Android), `SecRandom` (iOS).

---

## Invariant 8: Safe Failure
> **Rule**: Any crypto failure must fail closed (reject message).
> **Enforcement**: Exception handling must never return "success" on crypto error.

---

## Invariant 9: No Key Material Logging
> **Rule**: No private keys, session keys, derived secrets, or raw decrypted payloads may ever appear in logs/debug dumps.
> **Enforcement**: Automated log checks, strict Redact-by-Default policy.

---

## Invariant 10: Versioned Crypto Protocol Compatibility
> **Rule**: Messages must carry a protocol version and clients must fail safe if unsupported.
> **Enforcement**: Protocol header checks, explicit version negotiation.
