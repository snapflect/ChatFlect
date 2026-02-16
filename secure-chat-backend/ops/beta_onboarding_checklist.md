# Beta Onboarding Checklist
**Epic 101: Internal Beta**

## 1. Pre-Flight Checks
- [ ] **Staging Environment**: Verify `https://staging-api.chatflect.com/api/status.php` is returning 200 OK.
- [ ] **Database**: Verify `users` table is clean (or ready for new users).
- [ ] **Email Service**: Verify SMTP credentials are active (Required for invites).

## 2. Invite Process (Secure)
1.  Open a terminal in the backend root.
2.  Run the secure invitation tool:
    ```bash
    export DB_PASSWORD=your_db_pass
    php scripts/invite_beta_user.php -u beta_user_1 -e beta1@internal.chatflect.com
    ```
3.  **Copy the generated temporary password**.
4.  Send Welcome Email manually (Secure Channel recommended for password).

### Privacy & Consent (Step 2a)
> **IMPORTANT**: Before sending the invite, you MUST inform the user:
> "By joining the Beta, you acknowledge that your data (messages, metadata) may be wiped at any time and may be inspected by the Engineering Team for debugging purposes."

## 3. Client Distribution
- **Android**: Share APK via Google Drive / Firebase App Distribution.
- **iOS**: Add email to TestFlight Internal Group.

## 4. Verification
- [ ] Ask user to log in.
- [ ] Ask user to send a "Hello World" message to the Echo Bot (User ID 0).
