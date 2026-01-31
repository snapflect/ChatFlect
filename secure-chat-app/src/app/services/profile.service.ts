import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import { SecureMediaService } from './secure-media.service';
import { StorageService } from './storage.service';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class ProfileService {

    constructor(
        private api: ApiService,
        private auth: AuthService,
        private logger: LoggingService,
        private secureMedia: SecureMediaService,
        private storage: StorageService
    ) { }

    async getProfile() {
        // We use the ID from localStorage as it's more reliable than the observable in some flows
        const id = localStorage.getItem('user_id');
        if (!id) return null;

        // 1. Try Cache First for instant UI
        const cached = await this.storage.getMeta('profile_data');
        if (cached && cached.user_id === id) {
            console.log('[Profile] Loaded from cache');
            // Background sync
            this.syncProfileInBackground(id);
            return cached;
        }

        return await this.syncProfileInBackground(id);
    }

    getUserProfile(userId: string) {
        return this.api.get(`profile.php?user_id=${userId}`);
    }

    private async syncProfileInBackground(id: string) {
        try {
            const apiRes: any = await this.api.get(`profile.php?user_id=${id}`).toPromise();

            // Check if API returned valid data. 
            if (!apiRes || !apiRes.first_name) {
                this.logger.log("[Profile] API profile incomplete, checking Firestore fallback...");
                const db = this.firestoreGetInstance();
                const docSnap = await this.firestoreGetDoc(this.firestoreDoc(db, 'users', id));
                if (docSnap.exists()) {
                    const firestoreData = docSnap.data() as any;
                    this.logger.log("[Profile] Found in Firestore:", firestoreData);
                    this.logger.log("[Profile] API photo_url:", apiRes.photo_url);
                    this.logger.log("[Profile] Firestore photo_url:", firestoreData.photo_url);

                    // Merge logic: Favor non-empty photo_url from either source
                    const merged = { ...apiRes, ...firestoreData, user_id: id };

                    if (apiRes.photo_url && (!firestoreData.photo_url || firestoreData.photo_url === '')) {
                        merged.photo_url = apiRes.photo_url;
                    } else if (!apiRes.photo_url && firestoreData.photo_url) {
                        merged.photo_url = firestoreData.photo_url;
                    } else if (apiRes.photo_url && firestoreData.photo_url && apiRes.photo_url !== firestoreData.photo_url) {
                        // Favor Google URL if it's there
                        if (apiRes.photo_url.includes('googleusercontent.com')) {
                            merged.photo_url = apiRes.photo_url;
                        }
                    }

                    await this.storage.setMeta('profile_data', merged);
                    return merged;
                }
            }

            if (apiRes) {
                this.logger.log(`[ProfileService] Sync result photo_url: ${apiRes.photo_url}`);
                apiRes.user_id = id;
                await this.storage.setMeta('profile_data', apiRes);
            }

            this.logger.log("[Profile] Final Profile synced");
            return apiRes;
        } catch (e) {
            this.logger.error("[Profile] Sync Error", e);
            return await this.storage.getMeta('profile_data');
        }
    }

    async updateProfile(profileData: any) {
        const id = localStorage.getItem('user_id');

        // 1. Update MySQL (Legacy/API) - Primary, must complete
        const result = await this.api.post('profile.php', { ...profileData, user_id: id }).toPromise();

        // 2. Update Firestore (Sync for CallService) - Background, non-blocking
        if (id) {
            const db = this.firestoreGetInstance();
            const userRef = this.firestoreDoc(db, 'users', id);
            const username = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Unknown';

            // Fire-and-forget: Don't block UI on Firestore sync
            setDoc(userRef, {
                first_name: profileData.first_name || '',
                last_name: profileData.last_name || '',
                short_note: profileData.short_note || '',
                photo_url: profileData.photo_url || '',
                phone_number: profileData.phone_number || '',
                username: username,
                updated_at: Date.now()
            }, { merge: true })
                .then(() => this.logger.log("[Profile] Synced to Firestore for user:", id))
                .catch(e => this.logger.error("[Profile] Failed to sync to Firestore", e));
        }

        return result;
    }

    async requestPhoneUpdateOtp(email: string, newPhone: string) {
        return this.api.post('register.php', { email, phone_number: newPhone, action: 'phone_update' }).toPromise();
    }

    async verifyPhoneUpdate(email: string, otp: string) {
        // Technically this could just be a special call to profile.php 
        // to verify against the otps table for this email
        return this.api.post('profile.php', {
            action: 'verify_phone_otp',
            email: email,
            otp: otp
        }).toPromise();
    }

    async uploadPhoto(formData: FormData): Promise<string> {
        // Unified Pipeline: Extract the file from FormData and use SecureMediaService
        // Note: SecureMediaService expects a Blob. FormData has 'file'.
        try {
            const file = formData.get('file');
            if (file && file instanceof Blob) {
                // Profile Photos are NOT encrypted (publicly visible usually, or handled by server Auth).
                // Existing logic suggested plaintext upload to 'upload.php'.
                // SecureMediaService.uploadMedia wraps this correctly.
                const metadata = await this.secureMedia.uploadMedia(file, false); // Encrypt = false
                return metadata.url;
            } else {
                throw new Error("No valid file in FormData");
            }
        } catch (e) {
            this.logger.error("Upload Service Error", e);
            throw e;
        }
    }

    protected firestoreGetInstance() {
        return getFirestore();
    }

    protected async firestoreGetDoc(ref: any) {
        return await getDoc(ref);
    }

    protected firestoreDoc(ref: any, ...paths: string[]) {
        return (doc as any)(ref, ...paths);
    }
}
