import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, throwError } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { CryptoService } from './crypto.service';
import { PushService } from './push.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { LoggingService } from './logging.service';
import { CallService } from './call.service';
import { getFirestore, collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, Unsubscribe } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from 'src/environments/environment';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { SecureMediaService } from './secure-media.service';
import { SecureStorageService } from './secure-storage.service';

import { db, auth } from './firebase.config';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userIdSource = new BehaviorSubject<string | null>(null);
    currentUserId = this.userIdSource.asObservable();
    private db = db; // Use singleton

    // Blocked Users Stream
    private blockedUsersSubject = new BehaviorSubject<string[]>([]);
    blockedUsers$ = this.blockedUsersSubject.asObservable();
    private blockedUnsub?: Unsubscribe;
    private firebaseSigningIn = false;

    private userBlockedAlertShown = false;

    // ... (rest of props)

    constructor(
        private api: ApiService,
        private crypto: CryptoService,
        private pushService: PushService,
        private logger: LoggingService,
        private callService: CallService,
        private mediaService: SecureMediaService,
        private secureStorage: SecureStorageService // v13
    ) {
        // App initialized in firebase.config.ts
        // this.db assigned above

        // Initialize Google Auth on native platforms
        if (Capacitor.isNativePlatform()) {
            GoogleAuth.initialize({
                clientId: environment.googleClientId,
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            });
        }

        // 🔥 Event-Driven Readiness (The Truth)
        onAuthStateChanged(auth, user => { // Use singleton 'auth'
            if (user) {
                this.logger.log('[Auth] Firebase AUTH READY', { uid: user.uid });
                this.firebaseReadySubject.next(true);
            } else {
                this.logger.log('[Auth] Firebase AUTH LOST');
                this.firebaseReadySubject.next(false);
                this.firebaseSigningIn = false;
            }
        });

        // 🛡️ Defensive Hardening (Enterprise Level)
        // If auth user exists but event didn't fire (race condition), force it after 3s
        setTimeout(() => {
            if (!this.firebaseReadySubject.value && auth.currentUser) {
                this.logger.warn('[Auth] Auth user present but event missed – correcting');
                this.firebaseReadySubject.next(true);
            }
        }, 3000);

        const savedId = localStorage.getItem('user_id');
        if (savedId && savedId.trim()) {
            const norm = savedId.trim().toUpperCase();
            this.userIdSource.next(norm);
            this.userBlockedAlertShown = false; // Reset on new user login
            this.initBlockedListener(norm);
            // v16.1 Fix: Ensure Firebase is authenticated on app restart
            this.signInToFirebase(norm);
        }

        // v16.5: Gate Push Token Sync (Race Condition Fix)
        // Ensure we only try to write the token to Firestore when we are CONFIRMED ready and authenticated.
        this.firebaseReady$
            .pipe(filter(Boolean), take(1))
            .subscribe({
                next: () => this.pushService.syncToken(),
                complete: () => this.logger.log('[Auth] Push token synced')
            });

    }

    private initBlockedListener(userId: string) {
        // 1. Initial Load from Local Storage (Instant)
        const cached = localStorage.getItem('blocked_users');
        if (cached) {
            this.blockedUsersSubject.next(JSON.parse(cached));
        }

        // 2. Real-time sync
        this.blockedUnsub?.();
        const blockedCol = collection(this.db, `users/${userId}/blocked`);
        this.blockedUnsub = onSnapshot(blockedCol, (snapshot) => {
            const blocked = snapshot.docs.map(d => d.id);
            localStorage.setItem('blocked_users', JSON.stringify(blocked));
            this.blockedUsersSubject.next(blocked);
        });
    }

    // --- Device Management (Phase 2) ---

    public getOrGenerateDeviceUUID(): string {
        let uuid = localStorage.getItem('device_uuid');
        if (!uuid) {
            uuid = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_uuid', uuid);
        }
        return uuid;
    }

    private async registerDevice(userId: string) {
        const uuid = this.getOrGenerateDeviceUUID();
        let pubKey = localStorage.getItem('public_key');
        if (!pubKey) {
            // Fallback: email OTP login stores key in secureStorage only
            pubKey = await this.secureStorage.getItem('public_key');
        }
        if (!pubKey) return; // Should have key by now

        // Get friendly name
        const info = await import('@capacitor/device').then(m => m.Device.getInfo()).catch(() => ({ model: 'Browser', platform: 'Web' }));
        const deviceName = `${info.platform} ${info.model || 'Device'}`;

        await this.api.post('devices.php?action=register', {
            user_id: userId,
            device_uuid: uuid,
            public_key: pubKey,
            device_name: deviceName
        }).toPromise();
    }

    async setSession(userId: string, token?: string, isProfileComplete?: boolean, refreshToken?: string) {
        // v16.0: Strict Normalization
        const normalizedId = String(userId || '').trim().toUpperCase();

        if (!normalizedId || normalizedId === 'UNDEFINED' || normalizedId === 'NULL') {
            this.logger.error('[Auth] setSession called with invalid userId:', userId);
            return;
        }

        localStorage.setItem('user_id', normalizedId);
        // Cookie Migration: Tokens now invalid in LocalStorage - removed to enforce Cookie usage
        // if (token) localStorage.setItem('id_token', token);
        // if (refreshToken) localStorage.setItem('refresh_token', refreshToken);

        if (isProfileComplete !== undefined) {
            localStorage.setItem('is_profile_complete', isProfileComplete ? '1' : '0');
        }
        this.userIdSource.next(normalizedId);
        this.initBlockedListener(normalizedId);

        // Register Device FIRST (must complete before Firebase auth)
        try {
            await this.registerDevice(normalizedId);
        } catch (e) {
            console.error('Device Reg Failed', e);
        }

        // Force Push Registration / Sync
        // this.pushService.syncToken(); // Moved to signInToFirebase result
        this.callService.init();

        // Ensure Firebase Auth (device must be registered first)
        this.signInToFirebase(normalizedId);
    }

    async refreshToken(): Promise<string | null> {
        const userId = localStorage.getItem('user_id');
        // Cookie Migration: Refresh token read from Cookie by backend
        const deviceUuid = localStorage.getItem('device_uuid');

        if (!userId) return null;

        try {
            const res: any = await this.api.post('refresh_token.php', {
                user_id: userId,
                // refresh_token: refreshToken, // Backend reads cookie
                device_uuid: deviceUuid
            }).toPromise();

            if (res && res.status === 'success') {
                // Tokens set in Cookie by backend
                return res.token;
            }
        } catch (e: any) {
            // v8.1: Only treat as blocked if backend explicitly says so
            const errorBody = e?.error;
            if (e?.status === 403 && errorBody?.status === 'blocked') {
                if (!this.userBlockedAlertShown) {
                    this.userBlockedAlertShown = true;
                    this.logout();
                    alert("This account has been blocked. Please contact support.");
                }
            } else if (e?.status === 403) {
                // Device error or session issue — don't force logout
                this.logger.warn('[Auth] 403 from refresh (device/session issue, not blocked)', errorBody);
            }
            this.logger.error("Token Refresh Failed", e);
        }
        return null;
    }

    private firebaseReadySubject = new BehaviorSubject<boolean>(false);
    public firebaseReady$ = this.firebaseReadySubject.asObservable();

    async signInToFirebase(userId: string) {
        // ... (unchanged)
        const authInstance = auth;

        // 1. Race Condition Guard
        if (authInstance.currentUser) {
            this.logger.log('[Auth] Firebase ALREADY authenticated', { uid: authInstance.currentUser.uid });
            if (!this.firebaseReadySubject.value) {
                // Wait for listener or the defensive timeout
            }
            return;
        }

        // 2. Concurrency Guard
        if (this.firebaseSigningIn) {
            this.logger.log('[Auth] Firebase Sign-In ALREADY IN PROGRESS');
            return;
        }
        this.firebaseSigningIn = true;

        const deviceUuid = localStorage.getItem('device_uuid') || this.getOrGenerateDeviceUUID();

        try {
            this.logger.log(`[Auth] Starting Custom Token Exchange for ${userId}...`);

            // Exchange PHP session for Firebase Token
            const res: any = await this.api.post('firebase_auth.php', { user_id: userId, device_uuid: deviceUuid }).toPromise();

            if (res && res.status === 'success') {
                const customToken = res.firebase_token || res.token;
                if (!customToken) {
                    throw new Error("Missing Firebase custom token in response");
                }

                this.logger.log("[Auth] Token received. Signing in...");

                await signInWithCustomToken(authInstance, customToken);

                this.logger.log("[Auth] signInWithCustomToken SUCCESS. User:", (authInstance.currentUser as any)?.uid);
            } else {
                this.logger.error("[Auth] Token Exchange FAILED. Response:", res);
            }
        } catch (e: any) {
            // Handle 403: distinguish blocked vs device issues
            if (e?.status === 403) {
                const errorBody = e?.error;
                if (errorBody?.error === 'Device not registered' || errorBody?.error === 'Device is not active or has been revoked') {
                    this.logger.warn('[Auth] Device not registered/active. Retrying registration...');
                    try {
                        await this.registerDevice(userId);
                        // Retry Firebase auth after re-registering device
                        const retryRes: any = await this.api.post('firebase_auth.php', { user_id: userId, device_uuid: deviceUuid }).toPromise();
                        if (retryRes?.status === 'success') {
                            const customToken = retryRes.firebase_token || retryRes.token;
                            if (customToken) {
                                await signInWithCustomToken(authInstance, customToken);
                                this.logger.log('[Auth] Firebase auth RETRY SUCCESS');
                                return;
                            }
                        }
                    } catch (retryErr) {
                        this.logger.error('[Auth] Device re-registration retry failed', retryErr);
                    }
                } else if (errorBody?.status === 'blocked') {
                    if (!this.userBlockedAlertShown) {
                        this.userBlockedAlertShown = true;
                        this.logout();
                        alert('This account has been blocked. Please contact support.');
                    }
                    return;
                }
            }
            this.logger.error("[Auth] Firebase Custom Auth EXCEPTION", e);
        } finally {
            this.firebaseSigningIn = false;
        }
    }

    // Phase 17: Email OTP
    requestOtp(email: string) {
        if (!email || !email.includes('@')) {
            return throwError(() => new Error('Invalid email address'));
        }
        return this.api.post('register.php', { email: email });
    }

    // Phase 17: Verify OTP and Register/Login
    async verifyOtp(otp: string, email: string) {
        try {
            // 1. Generate Key Pair (Real)
            const keys = await this.crypto.generateKeyPair();
            const publicKeyStr = await this.crypto.exportKey(keys.publicKey);
            const privateKeyStr = await this.crypto.exportKey(keys.privateKey);

            // Store Private Key Locally (Critical for decryption) -> Now Secure
            await this.secureStorage.setItem('private_key', privateKeyStr);
            await this.secureStorage.setItem('public_key', publicKeyStr);
            // Redundant plaintext copy REMOVED for security
            // localStorage.setItem('public_key', publicKeyStr); // Optional: keep public key accessible if needed sync

            // 2. Call API to confirm
            const response: any = await this.api.post('profile.php', {
                action: 'confirm_otp',
                email: email,
                otp: otp,
                public_key: publicKeyStr
            }).toPromise();

            if (response && response.status === 'success') {
                this.setSession(response.user_id, response.token, !!response.is_profile_complete, response.refresh_token);

                // CRITICAL: Verify the server actually updated our Public Key
                // (Addresses the "Stale Key" issue if server schema is improper)
                setTimeout(async () => {
                    try {
                        const verifyRes: any = await this.api.get(`keys.php?user_id=${response.user_id}&_t=${Date.now()}`).toPromise();
                        if (verifyRes && verifyRes.public_key) {
                            if (verifyRes.public_key.replace(/\s/g, '') !== publicKeyStr.replace(/\s/g, '')) {
                                this.logger.error("CRITICAL: Server Public Key mismatch! Encryption will fail.");
                                alert("Warning: Server failed to update your encryption key. Reinstall required.");
                            } else {
                                this.logger.log("Key exchange verified successfully.");
                            }
                        }
                    } catch (e) { console.error("Key verification failed", e); }
                }, 2000);

                return response;
            }
            const errorMsg = (response && response.message) ? response.message : 'API Error: Registration Failed';
            throw new Error(errorMsg);
        } catch (e: any) {
            this.logger.error("Auth Error", e);
            throw new Error((e && e.message) ? e.message : 'Verification Failed');
        }
    }

    // Google OAuth Sign-In
    async signInWithGoogle(): Promise<any> {
        try {
            // 1. Sign in with Google
            const googleUser = await GoogleAuth.signIn();
            this.logger.log("Google Sign-In Success", googleUser);

            // 2. Generate encryption keys (just like OTP flow)
            const keys = await this.crypto.generateKeyPair();
            const publicKeyStr = await this.crypto.exportKey(keys.publicKey);
            const privateKeyStr = await this.crypto.exportKey(keys.privateKey);

            // Store Private Key Locally
            await this.secureStorage.setItem('private_key', privateKeyStr);
            await this.secureStorage.setItem('public_key', publicKeyStr);

            // 3. Send to backend for verification/registration
            const googleUserAny = googleUser as any;
            const platform = (Capacitor.getPlatform() || 'web').toUpperCase(); // 'ANDROID', 'IOS', 'WEB'

            const response: any = await this.api.post('oauth.php', {
                provider: 'google',
                id_token: googleUserAny.authentication?.idToken || googleUserAny.idToken,
                email: googleUser.email,
                name: googleUser.name || googleUser.givenName,
                photo_url: googleUser.imageUrl,
                public_key: publicKeyStr,
                platform: platform, // Dynamic Platform Field (Security Hardening)
                device_uuid: this.getOrGenerateDeviceUUID() // Ensure valid UUID is generated & sent
            }).toPromise();

            if (response && response.status === 'success') {
                const token = response.token || googleUserAny.authentication?.idToken || googleUserAny.idToken;
                await this.setSession(response.user_id, token, !!response.is_profile_complete, response.refresh_token);

                // Cache user info
                if (googleUser.name || googleUser.givenName) {
                    localStorage.setItem('user_first_name', googleUser.givenName || googleUser.name);
                }

                return response;
            }

            throw new Error(response?.message || 'Google Sign-In failed');
        } catch (e: any) {
            this.logger.error("Google Sign-In Error", e);

            // Handle user cancellation
            if (e?.message?.includes('cancel') || e?.code === 'popup_closed_by_user') {
                throw new Error('Sign-in cancelled');
            }

            throw new Error(e?.message || 'Google Sign-In failed');
        }
    }

    // Sign out from Google (call on logout)
    async signOutGoogle() {
        try {
            await GoogleAuth.signOut();
        } catch (e) {
            // Ignore errors during sign out
        }
    }

    async logout() {
        try {
            // 1. Clear Backend Cookies
            await this.api.post('logout.php', {}).toPromise();
        } catch (e) {
            console.warn("[Auth] Backend Logout Error", e);
        }

        try {
            await signOut(auth);
        } catch (e) {
            console.warn("[Auth] Firebase SignOut Error", e);
        }

        // Listener Cleanup
        this.blockedUnsub?.();
        this.blockedUnsub = undefined;

        this.signOutGoogle();
        this.mediaService.clearCache('LOGOUT');
        this.mediaService.clearCache('LOGOUT');
        localStorage.removeItem('user_id');
        localStorage.removeItem('id_token'); // Just in case
        localStorage.removeItem('is_profile_complete');

        await this.secureStorage.removeItem('private_key');
        await this.secureStorage.removeItem('public_key');

        localStorage.removeItem('user_first_name');
        localStorage.removeItem('refresh_token'); // Just in case
        localStorage.removeItem('blocked_users');
        localStorage.removeItem('device_uuid'); // v16.0: Full wipe on logout to force fresh session
        this.userIdSource.next(null);

        // 🔥 Robust Subject Reset
        this.firebaseReadySubject.next(false);
        this.firebaseSigningIn = false;
    }

    isAuthenticated(): boolean {
        const val = this.userIdSource.value;
        return !!(val && val.trim() !== '' && val.toUpperCase() === val);
    }

    getUserId(): string {
        return this.userIdSource.value || '';
    }

    getDeviceId(): number {
        const stored = localStorage.getItem('signal_device_id');
        return stored ? parseInt(stored, 10) : 1;
    }

    async updateProfile(data: { first_name?: string, last_name?: string, short_note?: string, photo_url?: string }) {
        const userId = localStorage.getItem('user_id');
        if (!userId) throw new Error("Not logged in");

        return this.api.post('profile.php', {
            user_id: userId,
            ...data
        }).toPromise();
    }

    async getProfile(userId: string) {
        return this.api.get(`profile.php?user_id=${userId}`).toPromise();
    }

    // Blocking Features
    async blockUser(targetId: string) {
        const myId = this.userIdSource.value;
        if (!myId) return;

        await setDoc(doc(this.db, 'users', myId, 'blocked', targetId), {
            blocked_at: new Date().toISOString()
        });
    }

    async unblockUser(targetId: string) {
        const myId = this.userIdSource.value;
        if (!myId) return;

        await deleteDoc(doc(this.db, 'users', myId, 'blocked', targetId));
    }

    async isUserBlocked(targetId: string): Promise<boolean> {
        const myId = this.userIdSource.value;
        if (!myId) return false;

        try {
            const d = await getDoc(doc(this.db, 'users', myId, 'blocked', targetId));
            return d.exists();
        } catch (e: any) {
            // Offline: Assume not blocked to allow app usage
            if (e.message?.includes('offline') || e.code === 'unavailable') {
                return false;
            }
            throw e;
        }
    }

    async deleteAccount() {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        // 1. Delete from MySQL
        await this.api.post('delete_account.php', { user_id: myId }).toPromise();

        // 2. Delete Firestore (User Doc)
        // using Modular SDK
        await deleteDoc(doc(this.db, 'users', myId));

        // 3. Clear Local Storage
        this.logout();
    }
    async isProfileComplete(): Promise<boolean> {
        const userId = this.userIdSource.value || localStorage.getItem('user_id');
        if (!userId) return false;

        // Check local storage flag first
        const isCompleteFlag = localStorage.getItem('is_profile_complete');
        if (isCompleteFlag === '1') return true;

        const cachedName = localStorage.getItem('user_first_name');
        if (cachedName) return true;

        try {
            const profile: any = await this.getProfile(userId);
            if (profile && profile.first_name) {
                // Cache it
                localStorage.setItem('user_first_name', profile.first_name);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    async rotateKeys() {
        const userId = this.userIdSource.value;
        if (!userId) throw new Error("Not logged in");

        // 1. Generate New Keys
        const keys = await this.crypto.generateKeyPair();
        const pub = await this.crypto.exportKey(keys.publicKey);
        const priv = await this.crypto.exportKey(keys.privateKey);

        // 2. Update Local Storage -> Secure Storage
        await this.secureStorage.setItem('public_key', pub);
        await this.secureStorage.setItem('private_key', priv);

        // 3. Sync with Server (Update Device Record)
        await this.registerDevice(userId);
    }
}
