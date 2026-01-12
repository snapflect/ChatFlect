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

    setSession(userId: string) {
        localStorage.setItem('user_id', userId);
        this.userIdSource.next(userId);
        this.initBlockedListener(userId);

        // Force Push Registration / Sync
        this.pushService.syncToken();
        this.callService.init();
    }

    // Phase 17: Email OTP
    requestOtp(phoneNumber: string, email: string) {
        if (!/^\+?[0-9]{10,15}$/.test(phoneNumber)) {
            return throwError(() => new Error('Invalid phone number format'));
        }
        if (!email || !email.includes('@')) {
            return throwError(() => new Error('Invalid email address'));
        }
        return this.api.post('register.php', { phone_number: phoneNumber, email: email });
    }

    // Phase 17: Verify OTP and Register/Login
    async verifyOtp(phoneNumber: string, otp: string, email: string) {
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
                phone_number: phoneNumber,
                email: email,
                otp: otp,
                public_key: publicKeyStr
            }).toPromise();

            if (response && response.status === 'success') {
                this.setSession(response.user_id);

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
            throw new Error(response.message || 'API Error: Registration Failed');
        } catch (e: any) {
            this.logger.error("Auth Error", e);
            throw new Error(e.message || 'Verification Failed');
        }
    }

    logout() {
        localStorage.removeItem('user_id');
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

        // Check local storage first (optimization)
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
