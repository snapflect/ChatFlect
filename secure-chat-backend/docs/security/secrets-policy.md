# Secrets Management Policy

## Overview
All secrets must be injected via environment variables — never hardcoded.

## Required Secrets
| Key | Description |
| :--- | :--- |
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASS` | MySQL password |
| `DB_NAME` | Database name |
| `ADMIN_API_TOKEN` | Admin API auth |
| `FIREBASE_PROJECT_ID` | Firebase project |

## Rotation Schedule
- `ADMIN_API_TOKEN`: 90 days
- `DB_PASS`: 180 days
- FCM keys: As needed

## Local Development
1. Copy `config/.env.example` to `config/.env`
2. Fill in values
3. Never commit `.env`

## Production
Use hosting platform's secret manager:
- Vercel: Environment Variables
- AWS: Secrets Manager
- GCP: Secret Manager
- Azure: Key Vault

## CI Secrets
Set in GitHub: Settings > Secrets > Actions
- `API_URL`
- `ADMIN_API_TOKEN`

## Prohibited
❌ Hardcoded project IDs
❌ service-account.json in repo
❌ Tokens in code comments
❌ Secrets in logs

## Verification
CI runs `gitleaks` to detect leaks.
