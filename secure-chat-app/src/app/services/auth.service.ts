import { Injectable, Injector } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, throwError, firstValueFrom, Subject } from 'rxjs';
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
import { SignalService } from './signal.service';
import { SignalStoreService } from './signal-store.service';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { LocalDbService } from './local-db.service';

import { db, auth } from './firebase.config';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userIdSource = new BehaviorSubject<string | null>(null);
    currentUserId = this.userIdSource.asObservable();
    private db = db; // Use singleton

    public logoutSubject = new Subject<void>();
    public logout$ = this.logoutSubject.asObservable();

    // Blocked Users Stream
    private blockedUsersSubject = new BehaviorSubject<string[]>([]);
    blockedUsers$ = this.blockedUsersSubject.asObservable();
    private blockedUnsub?: Unsubscribe;
    private firebaseSigningIn = false;
    private authUnsub?: Unsubscribe;

    // 🔥 Auth State Barrier (HF-Race Fix)
    public authReadyPromise = new Promise<void>((resolve) => {
        this.authReadyResolver = resolve;
    });
    private authReadyResolver!: () => void;
    private authResolved = false;

    private refreshInProgress: Promise<void> | null = null;
    private refreshTimer: any = null;

    private resolveAuthPromise() {
        if (!this.authResolved && this.authReadyResolver) {
            this.authResolved = true;
            this.authReadyResolver();
        }
    }

    private userBlockedAlertShown = false;

    // ... (rest of props)

    // Lazy-loaded to break circular DI (HF-8.11)
    private _push: PushService | null = null;
    private get pushService(): PushService {
        if (!this._push) this._push = this.injector.get(PushService);
        return this._push!;
    }

    private _call: CallService | null = null;
    private get callService(): CallService {
        if (!this._call) this._call = this.injector.get(CallService);
        return this._call!;
    }

    private _media: SecureMediaService | null = null;
    private get mediaService(): SecureMediaService {
        if (!this._media) this._media = this.injector.get(SecureMediaService);
        return this._media!;
    }

    private _signal: SignalService | null = null;
    private get signal(): SignalService {
        if (!this._signal) this._signal = this.injector.get(SignalService);
        return this._signal!;
    }

    private _signalStore: SignalStoreService | null = null;
    private get signalStore(): SignalStoreService {
        if (!this._signalStore) this._signalStore = this.injector.get(SignalStoreService);
        return this._signalStore!;
    }

    private _localDb: LocalDbService | null = null;
    private get localDb(): LocalDbService {
        if (!this._localDb) this._localDb = this.injector.get(LocalDbService);
        return this._localDb!;
    }

    constructor(
        private api: ApiService,
        private crypto: CryptoService,
        private logger: LoggingService,
        private secureStorage: SecureStorageService,
        private injector: Injector
    ) { }

    /**
     * Phase 4: Deterministic Boot Sequence
     * Called by AppInitService to ensure AuthService is ready before app starts.
     */
    public async initialize(): Promise<void> {
        this.logger.log('[Auth] Initializing AuthService...');

        // 1. Initialize Google Auth on native platforms
        if (Capacitor.isNativePlatform()) {
            GoogleAuth.initialize({
                clientId: environment.googleClientId,
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            });
        }

        // 2. Setup Firebase Auth Listener
        this.authUnsub = onAuthStateChanged(auth, user => {
            if (user) {
                this.logger.log('[Auth] Firebase AUTH READY', { uid: user.uid });
                this.firebaseReadySubject.next(true);
            } else {
                this.logger.log('[Auth] Firebase AUTH LOST');
                this.firebaseReadySubject.next(false);
                this.firebaseSigningIn = false;
            }
        });

        // 3. Restore Session
        const savedId = localStorage.getItem('user_id');
        if (savedId && savedId.trim()) {
            const norm = savedId.trim().toUpperCase();
            this.userIdSource.next(norm);
            this.userBlockedAlertShown = false;
            this.initBlockedListener(norm);

            // Proactively sign in to Firebase
            await this.signInToFirebase(norm);

            // Start proactive refresh loop
            this.startRefreshTimer();
        } else {
            // No saved session, we are "ready" to show login screen
            this.resolveAuthPromise();
        }

        // 4. Trigger Push Sync (Non-blocking)
        this.firebaseReady$
            .pipe(filter(Boolean), take(1))
            .subscribe(() => {
                this.pushService.syncToken().catch((e: any) =>
                    this.logger.error('[Auth] Initial Push Sync Failed', e)
                );
            });
    }

    private initBlockedListener(userId: string) {
        // 1. Initial Load from Local Storage (Instant)
        const cached = localStorage.getItem('blocked_users');
        if (cached && cached !== 'undefined') {
            try {
                this.blockedUsersSubject.next(JSON.parse(cached));
            } catch (e) {
                this.logger.error('[Auth] Failed to parse blocked_users', e);
            }
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

        // HF-4.1: Fetch ZK-S salt after registration/login
        await this.getOrFetchContactSalt(userId);
    }

    /**
     * HF-4.1: Retrieve device-specific salt for ZK-S contact hashing
     */
    async getOrFetchContactSalt(userId: string): Promise<string | null> {
        try {
            // 1. Check Secure Storage
            const salt = await this.secureStorage.getItem('contact_device_salt');
            if (salt) return salt;

            // 2. Fetch from Backend
            this.logger.log('[Auth] Fetching ZK-S device salt...');
            const res: any = await this.api.get(`auth_salt.php?user_id=${userId}&device_uuid=${this.getOrGenerateDeviceUUID()}`).toPromise();

            if (res && res.success && res.salt) {
                await this.secureStorage.setItem('contact_device_salt', res.salt);
                return res.salt;
            }
            return null;
        } catch (e) {
            this.logger.error('[Auth] Failed to fetch ZK-S salt', e);
            return null;
        }
    }

    async setSession(userId: string, token?: string, isProfileComplete?: boolean, refreshToken?: string) {
        // v16.0: Strict Normalization
        const normalizedId = String(userId || '').trim().toUpperCase();

        if (!normalizedId || normalizedId === 'UNDEFINED' || normalizedId === 'NULL') {
            this.logger.error('[Auth] setSession called with invalid userId:', userId);
            return;
        }

        localStorage.setItem('user_id', normalizedId);
        // Clear nuke flag on successful session
        localStorage.removeItem('vault_nuked');
        localStorage.removeItem('vault_fail_count');
        // Cookie Migration: Tokens now invalid in LocalStorage - removed to enforce Cookie usage
        // if (token) localStorage.setItem('id_token', token);
        if (isProfileComplete) localStorage.setItem('is_profile_complete', '1');
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken);

        this.userIdSource.next(normalizedId);
        this.initBlockedListener(normalizedId);
        this.signInToFirebase(normalizedId);
        try {
            await this.registerDevice(normalizedId);
        } catch (e) {
            console.error('Device Reg Failed', e);
        }

        // Phase 4: Start refresh loop
        this.startRefreshTimer();

        // HF-5A: Proactive Signal Registration
        try {
            // HF-Race Fix: Wait for Vault Unlock
            await this.localDb.readyPromise;

            const hasIdentity = await this.signalStore.getIdentityKeyPair();
            if (!hasIdentity) {
                this.logger.log('[Auth] No Signal Identity found. Registering keys...');
                await this.signal.register();
            }
        } catch (e) {
            this.logger.error('[Auth] Signal Registration Failed during setSession', e);
        }

        // Force Push Registration / Sync
        // this.pushService.syncToken(); // Moved to signInToFirebase result
    }

    private startRefreshTimer() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);

        // Check every 5 minutes
        this.refreshTimer = setInterval(() => {
            this.checkTokenExpiry();
        }, 5 * 60 * 1000);

        // Run immediately once
        this.checkTokenExpiry();
    }

    public async checkTokenExpiry() {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            if (this.refreshTimer) clearInterval(this.refreshTimer);
            return;
        }

        // We check if the Firebase token is near expiry, or if our PHP session might be old.
        // For simplicity in Phase 4, we'll just force a refresh if Firebase currentUser is missing or token is > 50 mins old.
        const authInstance = auth;
        if (!authInstance.currentUser) {
            this.logger.log('[Auth] Proactive: No Firebase user, triggering refresh...');
            this.refreshToken().catch(() => { });
            return;
        }

        try {
            const tokenResult = await authInstance.currentUser.getIdTokenResult();
            const issuedAt = new Date(tokenResult.issuedAtTime).getTime();
            const now = Date.now();
            const ageMinutes = (now - issuedAt) / 1000 / 60;

            if (ageMinutes > 45) { // Refresh if older than 45 mins (Firebase tokens last 60 mins)
                this.logger.log('[Auth] Proactive: Token age > 45m, refreshing...', { ageMinutes });
                this.refreshToken().catch(() => { });
            }
        } catch (e) {
            this.logger.error('[Auth] Failed to check token expiry', e);
        }
    }

    async refreshToken(): Promise<void> {
        if (this.refreshInProgress) {
            return this.refreshInProgress;
        }

        this.refreshInProgress = (async () => {
            const userId = localStorage.getItem('user_id');
            const deviceUuid = localStorage.getItem('device_uuid');

            if (!userId) {
                this.refreshInProgress = null;
                return;
            }

            try {
                this.logger.log('[Auth] Attempting token refresh...');
                // Cookie Migration: Refresh token read from Cookie by backend
                // withCredentials is CRITICAL for cookie exchange
                const res: any = await firstValueFrom(
                    this.api.post('refresh_token.php', {
                        user_id: userId,
                        device_uuid: deviceUuid
                    }, false)
                );

                if (res && res.status === 'success') {
                    // Update auth_token if provided as JTI/Fallback
                    if (res.token) localStorage.setItem('auth_token', res.token);
                    this.logger.log('[Auth] Token refreshed successfully');

                    // Re-sync Firebase if token refreshed
                    const userId = localStorage.getItem('user_id');
                    if (userId) this.signInToFirebase(userId);
                } else {
                    throw new Error(res?.message || 'Refresh failed on server');
                }
            } catch (e: any) {
                const errorBody = e?.error;
                this.logger.error('[Auth] Token refresh EXCEPTION', e);

                // HF-7.1 / HF-7.3: Handle Session Revocation & Fraud Detection
                if (e?.status === 403 && (errorBody?.error === 'FRAUD_DETECTED' || errorBody?.error === 'SESSION_REVOKED')) {
                    this.logger.error("[Auth] Security Revocation Triggered", errorBody);
                    this.logout();
                    alert("Security Alert: Your session has been terminated. Please log in again.");
                    throw e;
                }

                if (e?.status === 403 && errorBody?.status === 'blocked') {
                    if (!this.userBlockedAlertShown) {
                        this.userBlockedAlertShown = true;
                        this.logout();
                        alert("This account has been blocked. Please contact support.");
                    }
                    throw e;
                }

                // Generic failure - let the interceptor handle it
                throw e;
            } finally {
                this.refreshInProgress = null;
            }
        })();

        return this.refreshInProgress;
    }

    private firebaseReadySubject = new BehaviorSubject<boolean>(false);
    public firebaseReady$ = this.firebaseReadySubject.asObservable();

    async signInToFirebase(userId: string): Promise<void> {
        const authInstance = auth;

        // 1. Race Condition Guard (HF-Phase4)
        if (authInstance.currentUser) {
            this.logger.log('[Auth] Firebase ALREADY authenticated', { uid: authInstance.currentUser.uid });
            this.resolveAuthPromise();
            this.firebaseReadySubject.next(true);
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

                // 🔥 HF-Race Fix: Third Condition - Backend Session Confirmed
                try {
                    await this.api.get('ping.php').toPromise();
                    this.logger.log("[Auth] Backend session confirmed via ping.");
                } catch (pe) {
                    this.logger.warn("[Auth] Backend session ping failed/slow, resolving anyway to avoid hang", pe);
                }

                // 🔥 HF-Race Fix: Unblock background services!
                this.resolveAuthPromise();

            } else {
                this.logger.error("[Auth] Token Exchange FAILED. Response:", res);
            }
        } catch (e: any) {
            // Handle 403: distinguish blocked vs device issues
            if (e?.status === 403) {
                const errorBody = e?.error;
                if (errorBody?.error === 'Device not registered' ||
                    errorBody?.error === 'Device is not active or has been revoked' ||
                    errorBody?.error === 'Device Binding Required. Please re-authenticate.') {

                    this.logger.warn('[Auth] Device binding missing/broken. Attempting recovery...', errorBody);
                    try {
                        await this.registerDevice(userId);
                        // Force a fresh token exchange which will include the correct device_uuid
                        const retryRes: any = await this.api.post('firebase_auth.php', { user_id: userId, device_uuid: deviceUuid }).toPromise();
                        if (retryRes?.status === 'success') {
                            const customToken = retryRes.firebase_token || retryRes.token;
                            if (customToken) {
                                await signInWithCustomToken(authInstance, customToken);
                                this.logger.log('[Auth] Device binding recovery SUCCESS');
                                return;
                            }
                        }
                    } catch (retryErr) {
                        this.logger.error('[Auth] Device binding recovery FAILED', retryErr);
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

        // Notify background services that the user logged out
        this.logoutSubject.next();

        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        localStorage.removeItem('user_id');
        localStorage.removeItem('id_token'); // Just in case
        localStorage.removeItem('is_profile_complete');

        await this.secureStorage.removeItem('private_key');
        await this.secureStorage.removeItem('public_key');

        localStorage.removeItem('user_first_name');
        localStorage.removeItem('refresh_token'); // Just in case
        localStorage.removeItem('blocked_users');
        localStorage.removeItem('device_uuid'); // v16.0: Full wipe on logout to force fresh session
        await this.secureStorage.removeItem('contact_device_salt'); // HF-4.1
        this.userIdSource.next(null);

        // 🔥 Robust Subject Reset
        this.firebaseReadySubject.next(false);
        this.firebaseSigningIn = false;

        // Reset the Auth Barrier so background tasks pause again
        this.authResolved = false;
        this.authUnsub?.();
        this.authReadyPromise = new Promise<void>((resolve) => {
            this.authReadyResolver = resolve;
        });
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
