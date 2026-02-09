# Enterprise SSO

## Architecture
- **Protocol**: OIDC (OpenID Connect).
- **Binding**: Users are authenticated by IdP (e.g., Azure AD) and mapped to ChatFlect accounts by Email.
- **Domain Lock**: Critical check ensures `token.email` belongs to the Org's `allowed_domains`.

## Flow
1. **Init**: User visits `/sso/init.php?org_id=...`. System redirects to IdP.
2. **Auth**: User logs in at IdP.
3. **Callback**: IdP redirects back to `/sso/callback.php` with code.
4. **Validation**: System exchanges code, verifies JWT, checks Domain.
5. **Session**: ChatFlect session created.

## Security
- **Nonce/State**: Prevents CSRF and Replay.
- **TLS**: Required for all Identity exchanges.
