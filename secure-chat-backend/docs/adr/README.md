# Architecture Decision Records (ADR)

## Purpose
Document major technical decisions for traceability and onboarding.

## ADR Index

| # | Title | Status |
| :--- | :--- | :--- |
| [0001](./0001-relay-backend-migration.md) | Relay Backend Migration | Accepted |
| [0002](./0002-message-ordering-server-seq.md) | Message Ordering (server_seq) | Accepted |
| [0003](./0003-idempotency-uuidv7.md) | Idempotency via UUIDv7 | Accepted |
| [0004](./0004-repair-protocol.md) | Gap Detection + Repair | Accepted |
| [0005](./0005-receipts-stream.md) | Receipts Stream Design | Accepted |
| [0006](./0006-rate-limiting.md) | DB-Backed Rate Limiting | Accepted |
| [0007](./0007-abuse-scoring.md) | Abuse Scoring Framework | Accepted |
| [0008](./0008-sla-gate-ci.md) | SLA Gate CI Enforcement | Accepted |
| [0009](./0009-structured-logging.md) | Request ID + Structured Logging | Accepted |

## When ADR is Required

- ✅ New backend endpoints
- ✅ DB schema redesign
- ✅ Crypto/auth changes
- ✅ Message transport changes
- ✅ Storage migration
- ✅ CI enforcement changes

## Adding a New ADR

1. Copy `adr-template.md`
2. Name: `NNNN-short-title.md`
3. Fill all sections
4. Submit PR for review
5. Update this index

## Approval Workflow

1. Author submits ADR PR
2. Tech lead reviews
3. Security review (if applicable)
4. Accept → merge
