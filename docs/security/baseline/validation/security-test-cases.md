# Security Test Cases (TASK 1.4-A) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Total Test Cases**: 64

---

## TC-1.4-B: Authentication Flow Test Cases

### TC-B-01: Valid OTP Login
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-01 |
| **Description** | Verify successful OTP login flow |
| **Preconditions** | Valid phone number, Firebase Auth configured |
| **Steps** | 1. Enter phone number 2. Request OTP 3. Enter correct OTP 4. Verify login success |
| **Expected** | User authenticated, JWT issued, Firebase token obtained |
| **STRIDE Risk** | - |

### TC-B-02: Invalid OTP Rejection
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-02 |
| **Description** | Verify invalid OTP is rejected |
| **Preconditions** | Valid phone number, OTP sent |
| **Steps** | 1. Enter phone number 2. Request OTP 3. Enter incorrect OTP |
| **Expected** | Error displayed, login blocked |
| **STRIDE Risk** | - |

### TC-B-03: Expired OTP Rejection
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-03 |
| **Description** | Verify expired OTP is rejected |
| **Preconditions** | OTP sent, wait > 5 minutes |
| **Steps** | 1. Request OTP 2. Wait 5+ minutes 3. Enter OTP |
| **Expected** | OTP expired error |
| **STRIDE Risk** | - |

### TC-B-04: JWT Issuance Verification
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-04 |
| **Description** | Verify PHP JWT is issued after Firebase auth |
| **Preconditions** | Successful Firebase login |
| **Steps** | 1. Login successfully 2. Inspect localStorage/network |
| **Expected** | access_token present with valid JWT structure |
| **STRIDE Risk** | - |

### TC-B-05: JWT Refresh Flow
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-05 |
| **Description** | Verify JWT refresh works correctly |
| **Preconditions** | Authenticated user, expired access_token |
| **Steps** | 1. Wait for token expiry 2. Make API request 3. Verify silent refresh |
| **Expected** | New access_token issued, request succeeds |
| **STRIDE Risk** | - |

### TC-B-06: Invalid Refresh Token Rejection
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-06 |
| **Description** | Verify invalid refresh token is rejected |
| **Preconditions** | Modified/invalid refresh token |
| **Steps** | 1. Modify refresh token 2. Attempt refresh |
| **Expected** | 401 Unauthorized, forced re-login |
| **STRIDE Risk** | - |

### TC-B-07: Firebase Custom Token Exchange
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-07 |
| **Description** | Verify Firebase custom token exchange |
| **Preconditions** | Valid PHP JWT |
| **Steps** | 1. Inspect firebase_auth.php call 2. Verify custom token returned 3. Verify signInWithCustomToken |
| **Expected** | Valid Firebase ID token obtained |
| **STRIDE Risk** | - |

### TC-B-08: Blocked User Access (403)
| Field | Value |
| :--- | :--- |
| **ID** | TC-B-08 |
| **Description** | Verify blocked user cannot access |
| **Preconditions** | User flagged as blocked in backend |
| **Steps** | 1. Login as blocked user 2. Attempt API calls |
| **Expected** | 403 Forbidden on all requests |
| **STRIDE Risk** | - |

---

## TC-1.4-C: Device Provisioning Test Cases

### TC-C-01: Client-Side RSA Generation
| Field | Value |
| :--- | :--- |
| **ID** | TC-C-01 |
| **Description** | Verify RSA keypair generated client-side |
| **Preconditions** | New user registration |
| **Steps** | 1. Register new account 2. Inspect CryptoService calls 3. Verify generateKeyPair() |
| **Expected** | RSA-OAEP keypair generated locally |
| **STRIDE Risk** | - |

### TC-C-02: Private Key Never Leaves Device
| Field | Value |
| :--- | :--- |
| **ID** | TC-C-02 |
| **Description** | Verify private key not sent to backend |
| **Preconditions** | Device registration flow |
| **Steps** | 1. Capture network traffic 2. Inspect devices.php request body 3. Search for private key |
| **Expected** | Only public key in request, no private key |
| **STRIDE Risk** | E1 |

### TC-C-03: Device Registration Requires Auth
| Field | Value |
| :--- | :--- |
| **ID** | TC-C-03 |
| **Description** | Verify device registration requires authentication |
| **Preconditions** | Valid device data |
| **Steps** | 1. POST to devices.php without auth 2. Observe response |
| **Expected** | 401 Unauthorized (or 200 if gap exists - document) |
| **STRIDE Risk** | J4 |

### TC-C-04: 5-Device Limit Eviction
| Field | Value |
| :--- | :--- |
| **ID** | TC-C-04 |
| **Description** | Verify oldest device evicted at 5+ devices |
| **Preconditions** | User with 5 registered devices |
| **Steps** | 1. Register 6th device 2. Check oldest device status |
| **Expected** | Oldest device removed from registry |
| **STRIDE Risk** | - |

### TC-C-05: Evicted Device Message Access
| Field | Value |
| :--- | :--- |
| **ID** | TC-C-05 |
| **Description** | Verify evicted device cannot access messages |
| **Preconditions** | Device evicted from registry |
| **Steps** | 1. Attempt to decrypt new message on evicted device |
| **Expected** | Decryption fails, KEY_MISSING error |
| **STRIDE Risk** | - |

### TC-C-06: Duplicate Device UUID Injection
| Field | Value |
| :--- | :--- |
| **ID** | TC-C-06 |
| **Description** | Verify backend rejects duplicate device_uuid |
| **Preconditions** | Existing device_uuid known |
| **Steps** | 1. POST devices.php with existing uuid 2. Observe response |
| **Expected** | Error or update-in-place (document behavior) |
| **STRIDE Risk** | J4 |

---

## TC-1.4-D: E2EE Message Send Test Cases

### TC-D-01: AES Session Key Per Message
| Field | Value |
| :--- | :--- |
| **ID** | TC-D-01 |
| **Description** | Verify unique AES key generated per message |
| **Preconditions** | Two messages sent |
| **Steps** | 1. Send message 1 2. Send message 2 3. Compare encrypted keys |
| **Expected** | Different AES keys for each message |
| **STRIDE Risk** | - |

### TC-D-02: Ciphertext Only in Firestore
| Field | Value |
| :--- | :--- |
| **ID** | TC-D-02 |
| **Description** | Verify no plaintext in Firestore |
| **Preconditions** | Message sent |
| **Steps** | 1. Send message 2. Inspect Firestore document 3. Search for plaintext |
| **Expected** | Only ciphertext in `text` field, no plaintext |
| **STRIDE Risk** | I1 |

### TC-D-03: Key Fan-out Map Creation
| Field | Value |
| :--- | :--- |
| **ID** | TC-D-03 |
| **Description** | Verify keys map contains all recipient devices |
| **Preconditions** | Recipient with 2 devices |
| **Steps** | 1. Send message 2. Inspect Firestore `keys` map |
| **Expected** | Entry for each recipient device |
| **STRIDE Risk** | I2 |

### TC-D-04: Outbox Persistence Before Upload
| Field | Value |
| :--- | :--- |
| **ID** | TC-D-04 |
| **Description** | Verify message persisted locally before Firestore |
| **Preconditions** | Message send initiated |
| **Steps** | 1. Go offline 2. Send message 3. Check SQLite/localStorage |
| **Expected** | Message in local outbox with pending status |
| **STRIDE Risk** | - |

### TC-D-05: Offline to Online Retry
| Field | Value |
| :--- | :--- |
| **ID** | TC-D-05 |
| **Description** | Verify offline messages sync when online |
| **Preconditions** | Pending messages in outbox |
| **Steps** | 1. Go offline 2. Queue messages 3. Go online |
| **Expected** | Messages uploaded to Firestore |
| **STRIDE Risk** | - |

### TC-D-06: Deterministic Delivery Order
| Field | Value |
| :--- | :--- |
| **ID** | TC-D-06 |
| **Description** | Verify message ordering is maintained |
| **Preconditions** | Multiple messages sent rapidly |
| **Steps** | 1. Send 5 messages quickly 2. Verify order in UI and Firestore |
| **Expected** | Messages appear in send order |
| **STRIDE Risk** | - |

---

## TC-1.4-H: Backend Auth Test Cases (J4-J9)

### TC-H-01: devices.php Without Auth (J4)
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-01 |
| **Description** | Test devices.php without authentication |
| **Preconditions** | Valid device registration payload |
| **Steps** | 1. POST to devices.php without Authorization header |
| **Expected** | 401 (or 200 if vulnerable - CRITICAL) |
| **STRIDE Risk** | J4 |

### TC-H-02: keys.php Without Auth
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-02 |
| **Description** | Test keys.php without authentication |
| **Preconditions** | Valid user_id |
| **Steps** | 1. GET keys.php?user_id=X without auth |
| **Expected** | 401 (or 200 if vulnerable) |
| **STRIDE Risk** | E1 |

### TC-H-03: groups.php Without Auth (J5)
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-03 |
| **Description** | Test groups.php without authentication |
| **Preconditions** | Valid group ID |
| **Steps** | 1. POST to groups.php?action=add_member without auth |
| **Expected** | 401 (or 200 if vulnerable - CRITICAL) |
| **STRIDE Risk** | J5 |

### TC-H-04: upload.php Without Auth (J6)
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-04 |
| **Description** | Test upload.php without authentication |
| **Preconditions** | Valid file payload |
| **Steps** | 1. POST file to upload.php without auth |
| **Expected** | 401 (or 200 if vulnerable - HIGH) |
| **STRIDE Risk** | J6 |

### TC-H-05: profile.php Scope Bypass (J7)
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-05 |
| **Description** | Test profile.php returns other user data |
| **Preconditions** | Authenticated as user A |
| **Steps** | 1. GET profile.php?user_id=B (another user) |
| **Expected** | 403 or limited data (or full PII if vulnerable - CRITICAL) |
| **STRIDE Risk** | J7 |

### TC-H-06: contacts.php Harvesting (J8)
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-06 |
| **Description** | Test contacts.php bulk extraction |
| **Preconditions** | Authenticated user |
| **Steps** | 1. GET contacts.php?search=* or empty search |
| **Expected** | Limited results, paginated (or full list if vulnerable - CRITICAL) |
| **STRIDE Risk** | J8 |

### TC-H-07: status.php Identity Spoofing (J9)
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-07 |
| **Description** | Test status.php allows posting as another user |
| **Preconditions** | Authenticated as user A |
| **Steps** | 1. POST status with user_id=B |
| **Expected** | Rejected or ignored (or accepted if vulnerable - HIGH) |
| **STRIDE Risk** | J9 |

### TC-H-08: firebase_auth.php Requires Session
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-08 |
| **Description** | Test firebase_auth.php requires valid session |
| **Preconditions** | No active session |
| **Steps** | 1. POST to firebase_auth.php without session |
| **Expected** | 401 Unauthorized |
| **STRIDE Risk** | - |

### TC-H-09: refresh_token.php Requires Token
| Field | Value |
| :--- | :--- |
| **ID** | TC-H-09 |
| **Description** | Test refresh_token.php requires valid token |
| **Preconditions** | Invalid/missing refresh token |
| **Steps** | 1. POST to refresh_token.php with invalid token |
| **Expected** | 401 Unauthorized |
| **STRIDE Risk** | - |

---

## TC-1.4-J: Crypto Attack Test Cases

### TC-J-01: Backend Key Injection (E1)
| Field | Value |
| :--- | :--- |
| **ID** | TC-J-01 |
| **Description** | Test if backend can inject malicious public key |
| **Preconditions** | Access to keys.php or MySQL |
| **Steps** | 1. Modify user's publicKey in backend 2. Send message to victim 3. Check if message encrypted to attacker key |
| **Expected** | Document if possible (CRITICAL if yes) |
| **STRIDE Risk** | E1 |

### TC-J-02: Plaintext Backup Exposure (H2)
| Field | Value |
| :--- | :--- |
| **ID** | TC-J-02 |
| **Description** | Test if backup contains unencrypted private key |
| **Preconditions** | User with backup feature |
| **Steps** | 1. Export backup 2. Inspect JSON file 3. Search for private key |
| **Expected** | Private key encrypted (or plaintext if vulnerable - CRITICAL) |
| **STRIDE Risk** | H2 |

### TC-J-03: Cipher Version Downgrade
| Field | Value |
| :--- | :--- |
| **ID** | TC-J-03 |
| **Description** | Test if v2 client accepts v1 messages |
| **Preconditions** | v2 capable client |
| **Steps** | 1. Craft v1 envelope 2. Send to v2 client |
| **Expected** | Document acceptance behavior |
| **STRIDE Risk** | CP-04 |

### TC-J-04: Ciphertext Replay
| Field | Value |
| :--- | :--- |
| **ID** | TC-J-04 |
| **Description** | Test if replayed message is accepted |
| **Preconditions** | Captured valid message |
| **Steps** | 1. Copy message document 2. Re-insert with new ID |
| **Expected** | Document if duplicate appears in UI |
| **STRIDE Risk** | CP-05 |

---

## Test Case Summary

| Category | Count | CRITICAL Risks |
| :--- | :---: | :--- |
| Auth Flow (B) | 8 | - |
| Device Provisioning (C) | 6 | J4 |
| E2EE Send (D) | 6 | - |
| E2EE Receive (E) | 6 | - |
| Multi-Device Sync (F) | 5 | - |
| Token Storage (G) | 5 | G1 |
| Backend Auth (H) | 9 | J4, J5, J6, J7, J8 |
| Firestore Rules (I) | 7 | I1, I2 |
| Crypto Attacks (J) | 4 | E1, H2 |
| Logging (K) | 8 | - |
| **Total** | **64** | **9** |
