# Branch Protection Configuration

## Required Status Checks

Enable these checks to block PR merges on SLA regression:

1. **SLA Gate**
   - Job: `sla-check`
   - Blocks merge if status is DEGRADED or CRITICAL

2. **Reliability Tests**
   - Job: `reliability-tests`
   - Blocks merge if reliability tests fail

## GitHub Settings

1. Go to **Settings > Branches > Branch protection rules**
2. Add rule for `main` branch
3. Enable:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date
   - ✅ SLA Gate / sla-check
   - ✅ SLA Gate / reliability-tests
4. Enable:
   - ✅ Require approvals (1+)
   - ✅ Dismiss stale reviews

## Secrets Required

Add these GitHub Secrets:
- `API_URL`: Backend API URL
- `ADMIN_API_TOKEN`: Admin authentication token

## Manual Override

For emergency merges (SEV1), admins can:
1. Temporarily disable branch protection
2. Merge with `--force`
3. Re-enable branch protection
4. Document override in incident log
