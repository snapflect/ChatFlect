import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, throwError } from 'rxjs';
import { CryptoService } from './crypto.service';
import { PushService } from './push.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { LoggingService } from './logging.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { take } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userIdSource = new BehaviorSubject<string | null>(null);
    currentUserId = this.userIdSource.asObservable();

    // Blocked Users Stream
    private blockedUsersSubject = new BehaviorSubject<string[]>([]);
    blockedUsers$ = this.blockedUsersSubject.asObservable();

    constructor(
        private api: ApiService,
        private crypto: CryptoService,
        private pushService: PushService,
        private logger: LoggingService,
        private afs: AngularFirestore
    ) {
        const savedId = localStorage.getItem('user_id');
        if (savedId) {
            this.userIdSource.next(savedId);
            this.initBlockedListener(savedId);
        }
    }

    private initBlockedListener(userId: string) {
        this.afs.collection(`users/${userId}/blocked`).snapshotChanges().subscribe(snaps => {
            const blocked = snaps.map(s => s.payload.doc.id);
            this.blockedUsersSubject.next(blocked);
        });
    }

    setSession(userId: string) {
        localStorage.setItem('user_id', userId);
        this.userIdSource.next(userId);
        this.initBlockedListener(userId);

        // Save FCM Token now that we are logged in
        PushNotifications.checkPermissions().then(async (res) => {
            // Fix: Update PushService to check for stored token + UserID valid.
        });

        // Actually, easiest way:
        this.pushService.register(); // Re-trigger registration to get token again?
    }

    // Phase 1: Simulate sending OTP
    requestOtp(phoneNumber: string) {
        if (!/^\+?[0-9]{10,15}$/.test(phoneNumber)) {
            // Return error observable
            return throwError(() => new Error('Invalid phone number format (10-15 digits required)'));
        }
        return this.api.post('register.php', { phone_number: phoneNumber });
    }

    // Phase 1: Verify OTP and Register/Login
    async verifyOtp(phoneNumber: string, otp: string) {
        try {
            // 1. Generate Key Pair (Real)
            const keys = await this.crypto.generateKeyPair();
            const publicKeyStr = await this.crypto.exportKey(keys.publicKey);
            const privateKeyStr = await this.crypto.exportKey(keys.privateKey);

            // Store Private Key Locally (Critical for decryption)
            localStorage.setItem('private_key', privateKeyStr);
            localStorage.setItem('public_key', publicKeyStr);

            // 2. Call API to confirm and upload Public Key
            const response: any = await this.api.post('profile.php', {
                action: 'confirm_otp',
                phone_number: phoneNumber,
                public_key: publicKeyStr
            }).toPromise();

            if (response && response.status === 'success') {
                this.setSession(response.user_id);
                return { success: true };
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

        await this.afs.collection(`users/${myId}/blocked`).doc(targetId).set({
            blocked_at: new Date().toISOString()
        });
    }

    async unblockUser(targetId: string) {
        const myId = this.userIdSource.value;
        if (!myId) return;

        await this.afs.collection(`users/${myId}/blocked`).doc(targetId).delete();
    }

    async isUserBlocked(targetId: string): Promise<boolean> {
        const myId = this.userIdSource.value;
        if (!myId) return false;

        const doc = await this.afs.collection(`users/${myId}/blocked`).doc(targetId).get().toPromise();
        return doc ? doc.exists : false;
    }

    async deleteAccount() {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        // 1. Delete from MySQL
        await this.api.post('delete_account.php', { user_id: myId }).toPromise();

        // 2. Delete Firestore (User Doc)
        // using AngularFirestore
        await this.afs.collection('users').doc(myId).delete();

        // 3. Clear Local Storage
        this.logout();
    }
}
