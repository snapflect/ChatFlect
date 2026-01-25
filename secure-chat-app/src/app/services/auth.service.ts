import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, throwError } from 'rxjs';
import { CryptoService } from './crypto.service';
import { PushService } from './push.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { LoggingService } from './logging.service';
import { CallService } from './call.service';
import { getFirestore, collection, doc, onSnapshot, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { environment } from 'src/environments/environment';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userIdSource = new BehaviorSubject<string | null>(null);
    currentUserId = this.userIdSource.asObservable();
    private db: any;

    // Blocked Users Stream
    private blockedUsersSubject = new BehaviorSubject<string[]>([]);
    blockedUsers$ = this.blockedUsersSubject.asObservable();

    constructor(
        private api: ApiService,
        private crypto: CryptoService,
        private pushService: PushService,
        private logger: LoggingService,
        private callService: CallService
    ) {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);

        // Initialize Google Auth on native platforms
        if (Capacitor.isNativePlatform()) {
            GoogleAuth.initialize({
                clientId: environment.googleClientId,
                scopes: ['profile', 'email'],
                grantOfflineAccess: true
            });
        }

        const savedId = localStorage.getItem('user_id');
        if (savedId) {
            this.userIdSource.next(savedId);
            this.initBlockedListener(savedId);
        }
    }

    private initBlockedListener(userId: string) {
        // Modular SDK onSnapshot
        const blockedCol = collection(this.db, `users/${userId}/blocked`);
        onSnapshot(blockedCol, (snapshot) => {
            const blocked = snapshot.docs.map(d => d.id);
            this.blockedUsersSubject.next(blocked);
        });
    }

    // --- Device Management (Phase 2) ---

    private getOrGenerateDeviceUUID(): string {
        let uuid = localStorage.getItem('device_uuid');
        if (!uuid) {
            uuid = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_uuid', uuid);
        }
        return uuid;
    }

    private async registerDevice(userId: string) {
        const uuid = this.getOrGenerateDeviceUUID();
        const pubKey = localStorage.getItem('public_key');
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

    setSession(userId: string, token?: string, isProfileComplete?: boolean) {
        localStorage.setItem('user_id', userId);
        if (token) {
            localStorage.setItem('id_token', token);
        }
        if (isProfileComplete !== undefined) {
            localStorage.setItem('is_profile_complete', isProfileComplete ? '1' : '0');
        }
        this.userIdSource.next(userId);
        this.initBlockedListener(userId);

        // Register Device (Phase 2) 
        this.registerDevice(userId).catch(e => console.error("Device Reg Failed", e));

        // Force Push Registration / Sync
        this.pushService.syncToken();
        this.callService.init();
    }

    // Phase 17: Email OTP
    requestOtp(email: string) {
        if (!email || !email.includes('@')) {
            return throwError(() => new Error('Invalid email address'));
        }
        return this.api.post('register.php', { email: email });
    }

    // Phase 17: Verify OTP and Register/Login
    // Phase 17: Verify OTP and Register/Login
    async verifyOtp(otp: string, email: string) {
        try {
            // 1. Generate Key Pair (Real)
            const keys = await this.crypto.generateKeyPair();
            const publicKeyStr = await this.crypto.exportKey(keys.publicKey);
            const privateKeyStr = await this.crypto.exportKey(keys.privateKey);

            // Store Private Key Locally (Critical for decryption)
            localStorage.setItem('private_key', privateKeyStr);
            localStorage.setItem('public_key', publicKeyStr);

            // 2. Call API to confirm
            const response: any = await this.api.post('profile.php', {
                action: 'confirm_otp',
                email: email,
                otp: otp,
                public_key: publicKeyStr
            }).toPromise();

            if (response && response.status === 'success') {
                this.setSession(response.user_id, response.token, !!response.is_profile_complete);

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
            localStorage.setItem('private_key', privateKeyStr);
            localStorage.setItem('public_key', publicKeyStr);

            // 3. Send to backend for verification/registration
            const googleUserAny = googleUser as any;
            const response: any = await this.api.post('oauth.php', {
                provider: 'google',
                id_token: googleUserAny.authentication?.idToken || googleUserAny.idToken,
                email: googleUser.email,
                name: googleUser.name || googleUser.givenName,
                photo_url: googleUser.imageUrl,
                public_key: publicKeyStr
            }).toPromise();

            if (response && response.status === 'success') {
                const token = googleUserAny.authentication?.idToken || googleUserAny.idToken;
                this.setSession(response.user_id, token, !!response.is_profile_complete);

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

    logout() {
        this.signOutGoogle();
        localStorage.removeItem('user_id');
        localStorage.removeItem('id_token');
        localStorage.removeItem('is_profile_complete');
        localStorage.removeItem('private_key');
        localStorage.removeItem('public_key');
        localStorage.removeItem('user_first_name');
        this.userIdSource.next(null);
    }

    isAuthenticated(): boolean {
        return !!this.userIdSource.value;
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

        const d = await getDoc(doc(this.db, 'users', myId, 'blocked', targetId));
        return d.exists();
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
}
