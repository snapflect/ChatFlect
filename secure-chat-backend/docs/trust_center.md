# Trust Center Documentation

## Welcome to the ChatFlect Trust Center
We believe security should be verifiable, not just promised. This API allows any third-party auditor, researcher, or user to verify the integrity of our platform.

## Endpoints

### 1. Discovery
`GET /api/v4/public/trust/index.php`
Returns the map of all trust resources. Start here.

### 2. Public Key
`GET /api/v4/public/trust/public_key.php`
The root of trust. Used to verify signatures on exports and reports.

### 3. Audit Integrity
`GET /api/v4/public/trust/audit_chain_tip.php`
Returns the latest hash of our immutable audit log. Monitors can poll this to detect if history is rewritten (forked).

### 4. Governance Rules
`GET /api/v4/public/trust/governance_policy.php`
Lists the meaningful rules for admin actions (e.g., "Permanent Bans require 2 admins").

### 5. Proof Aggregator
`GET /api/v4/public/trust/proofs.php`
A consolidated snapshot of all system integrity roots.

## Verification Guide
To verify a signed export:
1. Download the bundle (JSON + Sig).
2. Fetch our Public Key.
3. Run `openssl dgst -sha256 -verify public_key.pem -signature sig.bin export.json`.
