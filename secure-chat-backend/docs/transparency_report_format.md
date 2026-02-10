# Transparency Report Format (Epic 56)

## Overview
Automated governance report illustrating enforcement actions and compliance.

## JSON Schema
```json
{
  "header": {
    "report_id": "TR-2026-01",
    "period_start": "2026-01-01",
    "period_end": "2026-01-31",
    "generated_at": "2026-02-01T00:00:00Z",
    "node_id": "PRIMARY"
  },
  "security_stats": {
    "total_bans": 150,
    "permanent_bans": 10,
    "captcha_challenges": 5000,
    "rate_limit_hits": 25000,
    "abuse_score_avg": 45
  },
  "compliance_stats": {
    "gdpr_deletions_requested": 5,
    "gdpr_deletions_completed": 5,
    "legal_holds_active": 2,
    "legal_holds_expired": 1
  },
  "forensics_stats": {
    "case_exports": 3,
    "signed_bundles": 3
  },
  "integrity_stats": {
    "audit_chain_errors": 0,
    "signature_failures": 0
  }
}
```

## Definitions
- **total_bans**: Count of new `ip_banlist` entries in period.
- **gdpr_deletions_completed**: Count of `gdpr_delete_jobs` with status `DONE`.
- **audit_chain_errors**: Detected hash mismatches in `security_audit_log` (should be 0).
