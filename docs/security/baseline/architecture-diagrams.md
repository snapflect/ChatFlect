# System Architecture & Data Flows - ChatFlect

This document provides a visual and technical map of the ChatFlect system architecture, data flows, and trust boundaries.

## 1. High-Level Architecture

The system follows a hybrid architecture combining a traditional PHP/MySQL backend for master records and discovery, with Firebase for real-time messaging and notifications.

```mermaid
graph TD
    Client["Ionic Mobile App (Client)"]
    API["Backend PHP API (Trusted)"]
    DB[("MySQL (Master DB)")]
    FireAuth["Firebase Auth"]
    Firestore["Firestore (Real-time DB)"]
    FCM["Firebase Cloud Messaging (FCM)"]

    %% Client Interactions
    Client -- "1. Login/OTP/Profile" --> API
    Client -- "2. Device/Key Reg" --> API
    Client -- "3. Custom Token Exchange" --> API
    Client -- "4. Real-time Msgs" --> Firestore
    Client -- "5. Push Token Sync" --> Firestore

    %% API Interactions
    API -- "CRUD Users/Keys/Groups" --> DB
    API -- "Generate Custom Token" --> FireAuth
    API -- "Trigger Push" --> FCM
    
    %% Firebase Interactions
    FireAuth -- "Identity Provider" --> Firestore
    Firestore -- "Deliver Notify" --> FCM
    FCM -- "Push Notification" --> Client
```

---

## 2. Data Flow Diagram (DFD) & Trust Boundaries

Trust boundaries are defined between the untrusted mobile device and the trusted server-side infrastructure.

```mermaid
flowchart LR
    subgraph Untrusted_Zone [Client Device]
        direction TB
        App["ChatFlect App"]
        PrivateKeys["Private Keys (SecStorage)"]
        LocalDB["Outbox/Cache (SQLite)"]
    end

    subgraph Trusted_Zone [Server Infrastructure]
        direction TB
        API["PHP API Endpoints"]
        MySQL[("MySQL DB")]
        S3["Media Storage"]
    end

    subgraph SemiTrusted_Zone [Firebase Infrastructure]
        direction TB
        Firestore["Firestore Collections"]
        FireAuth["Firebase Auth"]
    end

    %% Key Material Flow
    App -- "Public Key / Device UUID" --> API
    API -- "Store Key Pair Meta" --> MySQL

    %% Identity Flow
    App -- "Credentials" --> API
    API -- "Validate & Auth" --> MySQL
    API -- "Custom Token" --> FireAuth
    FireAuth -- "STS Token" --> App

    %% Message Flow
    App -- "E2E Encrypted Payload" --> Firestore
    App -- "Encrypted Blobs" --> API
    API -- "Store Blob" --> S3

    %% Boundaries
    Untrusted_Zone -- "Auth Boundary" --- Trusted_Zone
    Untrusted_Zone -- "Auth Boundary" --- SemiTrusted_Zone
```

---

## 3. Sequence Diagrams

### 3.1 Authentication & Device Provisioning

Detailed flow of landing on a device, registering keys, and establishing a Firebase session.

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client (App)
    participant B as Backend (PHP)
    participant FA as Firebase Auth
    participant FS as Firestore

    U->>C: Enter Email / Login
    C->>B: requestOtp(email)
    B-->>U: Send OTP via Email
    U->>C: Enter OTP
    C->>C: generateKeyPair()
    C->>B: verifyOtp(otp, email, pubKey)
    B->>B: Save User & Primary Key
    B-->>C: user_id, session_token
    C->>C: Store privateKey locally
    
    rect rgb(240, 240, 240)
    Note over C, B: Device Provisioning
    C->>C: getOrGenerateDeviceUUID()
    C->>B: devices.php?action=register (uuid, pubKey)
    B->>B: Save Device Record
    end

    C->>B: firebase_auth.php (user_id)
    B->>B: Create Custom Token
    B-->>C: firebase_token
    C->>FA: signInWithCustomToken(token)
    FA-->>C: Auth SUCCESS
    C->>FS: Sync Push Token to user doc
```

---

### 3.2 E2EE Message Delivery Flow

How a message is encrypted and distributed to multiple recipients and their devices.

```mermaid
sequenceDiagram
    participant A as Sender (Device 1)
    participant B as Backend (Keys)
    participant FS as Firestore
    participant C as Recipient (Device 2)

    A->>A: generateSessionKey() (AES-256)
    A->>A: encryptPayload(text, sessionKey)
    A->>B: GET /keys.php?user_id=Recipient
    B-->>A: {primaryKey, deviceKeys: {devX: key, devY: key}}
    
    loop For each recipient device
        A->>A: encryptSessionKey(sessionKey, devicePubKey)
    end

    A->>FS: write to chats/{id}/messages/ (payload + keysMap)
    A->>B: POST /push.php (notify recipient)
    FS-->>C: Real-time Snapshot Event
    C->>C: Look up own device key in keysMap
    C->>C: decryptSessionKey(encSessionKey, privateKey)
    C->>C: decryptPayload(ciphertext, sessionKey)
    C-->>U: Display Message
```

---

## 4. Security Assumptions List

Based on the mapping, the system operates under the following assumptions:

1.  **Client-Side Integrity**: The application code on the device is unmodified (enforced via App Attestation or Play Integrity, if implemented).
2.  **Key Isolation**: The `private_key` never leaves the `SecureStorage` or `LocalStorage` of the device.
3.  **Transport Security**: All Client-Backend and Client-Firebase communication occurs over TLS (HTTPS/WSS).
4.  **Backend Trust**: The PHP API is trusted to manage the mapping of User IDs to Public Keys accurately (a "Key Transparency" audit is required to verify this assumption).
5.  **Firestore Isolation**: Firebase Security Rules are correctly configured to prevent unauthorized reads/writes to `chats` collections (Trust Boundary).
