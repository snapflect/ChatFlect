# System Components Inventory - ChatFlect

This document lists all major logical components in ChatFlect, their responsibilities, dependencies, and trust levels.

## Client-Side Components (Ionic/Angular)

| Module Name | Responsibility | Dependencies | Trust Level |
| :--- | :--- | :--- | :--- |
| **AuthService** | Manages user session, OTP verify, Firebase custom token exchange, device registration, and blocked users list. | `ApiService`, `CryptoService`, `PushService`, `Firebase Auth` | **Untrusted** (Device) |
| **ChatService** | Core messaging logic, Firestore message delivery, E2EE payload distribution, and reconciliation of optimistic UI. | `CryptoService`, `ApiService`, `Firestore`, `StorageService` | **Untrusted** (Device) |
| **CryptoService** | Low-level cryptographic primitives (RSA-OAEP, AES-256-GCM, HMAC-SHA256, HKDF, Ratchet). | `Web Crypto API` | **Untrusted** (Device) |
| **ApiService** | Centralized HTTP client for interacting with the backend PHP API. | `AuthService` (for token) | **Untrusted** (Device) |
| **StorageService** | Local persistence using SQLite/Capacitor Storage for outbox, settings, and cached messages. | `Capacitor SQLite` | **Untrusted** (Device) |
| **PushService** | Registration for FCM tokens and handling incoming push notifications. | `Capacitor Push`, `Firebase Messaging` | **Untrusted** (Device) |
| **PresenceService** | Real-time presence tracking (Online/Offline/Typing) via Firestore. | `Firestore`, `AuthService` | **Untrusted** (Device) |
| **SecureMediaService**| Processing and local handling of encrypted images, videos, and documents. | `CryptoService`, `ApiService` | **Untrusted** (Device) |
| **CallService** | WebRTC signaling for audio/video calls and CallKit/ConnectionService integration. | `ApiService`, `Firestore` | **Untrusted** (Device) |
| **SyncService** | Synchronization of offline actions (from Outbox) and historical message catching. | `ChatService`, `StorageService` | **Untrusted** (Device) |

## Backend Services (PHP API)

| Module Name | Responsibility | Dependencies | Trust Level |
| :--- | :--- | :--- | :--- |
| **register.php** | Handles initial email registration and OTP generation. | `MySQL`, `EmailService` | **Trusted** (Server) |
| **profile.php** | OTP verification, profile management, and initial public key registration. | `MySQL`, `AuthService` (Session) | **Trusted** (Server) |
| **firebase_auth.php**| Exchanges a valid PHP session/token for a Firebase Custom Token. | `Firebase Admin SDK` | **Trusted** (Server) |
| **devices.php** | Management of user device UUIDs and their respective encryption public keys. | `MySQL` | **Trusted** (Server) |
| **keys.php** | Retrieval of public keys for E2EE (both primary and device-specific). | `MySQL` | **Trusted** (Server) |
| **groups.php** | Master record management for group chats (members, metadata). | `MySQL` | **Trusted** (Server) |
| **contacts.php** | User discovery and contact list synchronization. | `MySQL` | **Trusted** (Server) |
| **upload.php** | Endpoint for uploading encrypted blobs (images/videos). | `FileSystem / S3` | **Trusted** (Server) |
| **push.php** | Logic for triggering FCM push notifications to specific users/devices. | `Firebase FCM` | **Trusted** (Server) |
| **refresh_token.php**| Rotates ID tokens and maintains long-lived sessions. | `MySQL` | **Trusted** (Server) |
| **audit_log.php** | Centralized security and error logging service. | `MySQL` | **Trusted** (Server) |

## Infrastructure (Firebase & Database)

| Service Name | Responsibility | Dependencies | Trust Level |
| :--- | :--- | :--- | :--- |
| **Firebase Auth** | Primary authentication gate for Firestore and FCM. | `firebase_auth.php` (Custom Tokens) | **Semi-Trusted** |
| **Firestore** | Real-time message transport, presence, and metadata storage. | Security Rules | **Semi-Trusted** |
| **Firebase FCM** | Delivery of push notifications to mobile devices. | `push.php` | **Semi-Trusted** |
| **MySQL Database** | Master source of truth for users, devices, groups, and contacts. | Backend PHP API | **Trusted** (Server) |

---
> [!NOTE]
> **Trust Level Definitions:**
> - **Trusted**: Fully controlled by ChatFlect infrastructure. Assumed safe for sensitive logic.
> - **Semi-Trusted**: Third-party infrastructure where data is protected by E2EE or security rules, but infrastructure availability/integrity is relying on provider.
> - **Untrusted**: Client-side execution context. Data and keys must be handled with the assumption that the device could be compromised or the user is malicious.
