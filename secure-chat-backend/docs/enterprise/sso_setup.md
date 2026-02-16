# SSO Setup Guide (OIDC)

> [!WARNING]
> **Security Critical**: Ensure your `redirect_uri` matches EXACTLY. Wildcards are NOT supported and introduce security vulnerabilities.
> Rotate your `OIDC_CLIENT_SECRET` annually.

> [!IMPORTANT]
> **Prerequisites**: The `/api/oauth/` endpoints are part of the Enterprise Module and must be enabled via `FEATURE_SSO_ENABLED=true`.

**Endpoint**: `/api/oauth/login.php`

## 1. Azure AD Configuration
1.  **Register App**: Go to Azure Portal > App Registrations > New Registration.
2.  **Redirect URI**: Set to `https://<YOUR_DOMAIN>/api/oauth/callback.php`.
3.  **Certificates & Secrets**: Generate a Client Secret.
4.  **Token Configuration**: Add optional claim `email` and `upn`.
5.  **Environment Variables**:
    ```env
    OIDC_PROVIDER=azure
    OIDC_CLIENT_ID=<Application (client) ID>
    OIDC_CLIENT_SECRET=<Client Secret>
    OIDC_TENANT_ID=<Directory (tenant) ID>
    ```

## 2. Okta Configuration
1.  **Create App Integration**: OIDC - Connect users to your app.
2.  **Sign-in Redirect URI**: `https://<YOUR_DOMAIN>/api/oauth/callback.php`.
3.  **Assignments**: Assign to "Everyone" or specific groups.
4.  **Environment Variables**:
    ```env
    OIDC_PROVIDER=okta
    OIDC_CLIENT_ID=<Client ID>
    OIDC_CLIENT_SECRET=<Client Secret>
    OIDC_ISSUER=https://<your-okta-domain>/oauth2/default
    ```

## 3. Attribute Mapping
ChatFlect maps the following claims automatically:
- `sub` -> Immutable User ID
- `email` -> Account Email
- `name` -> Display Name
