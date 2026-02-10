# Compliance Exports

## Scope
Metadata-only exports for legal/compliance review.

## Contents
1. **Manifest**: Signed inventory of the bundle.
2. **Members**: Roster snapshot.
3. **Devices**: Device registry snapshot.
4. **Policies**: Active + Historical rules.
5. **Audit**: Org-scoped activity log (metadata only).

## Security
- **Signed**: Server private key signs the manifest.
- **Governed**: Must be approved by Admins.
- **Bounded**: Max 10k rows per module to prevent DoS.
