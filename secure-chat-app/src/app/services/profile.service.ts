import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import { SecureMediaService } from './secure-media.service';
import { StorageService } from './storage.service';
import { LocalDbService } from './local-db.service';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class ProfileService {
    private profileCache = new Map<string, any>();
    private pendingProfileRequests = new Map<string, Promise<any>>();

    constructor(
        private api: ApiService,
        private auth: AuthService,
        private logger: LoggingService,
        private secureMedia: SecureMediaService,
        private storage: StorageService,
        private localDb: LocalDbService
    ) { }

    private normalizeId(userId: any): string {
        return String(userId || '').trim().toUpperCase();
    }

    getCachedProfile(userId: string) {
        return this.profileCache.get(this.normalizeId(userId));
    }

    /**
     * Resolves a user profile with caching and fallbacks.
     * Returns a safe object for UI display.
     */
    async resolve(userId: string): Promise<{ name: string, photo: string, profile?: any }> {
        if (!userId) return { name: 'User', photo: 'assets/user.png' };

        const raw = await this.resolveRaw(userId);
        if (!raw) return { name: 'User', photo: 'assets/user.png' };

        const name = ((raw.first_name || raw.username || 'User') + (raw.last_name ? ' ' + raw.last_name : '')).trim();
        const photo = raw.photo_url || raw.img || raw.avatar_url || 'assets/user.png';

        return { name, photo, profile: raw };
    }

    /**
     * Resolves the raw profile data from cache, API, or Firestore.
     */
    async resolveRaw(userId: string): Promise<any> {
        const key = this.normalizeId(userId);
        if (!key) return null;

        if (this.profileCache.has(key)) {
            return this.profileCache.get(key);
        }

        // Request Coalescing: Prevent duplicate syncs for the same user
        if (this.pendingProfileRequests.has(key)) {
            return this.pendingProfileRequests.get(key);
        }

        const request = this.syncProfileInBackground(key);
        this.pendingProfileRequests.set(key, request);

        try {
            const profile = await request;
            if (profile) {
                this.profileCache.set(key, profile);
            }
            return profile;
        } finally {
            this.pendingProfileRequests.delete(key);
        }
    }

    async getProfile() {
        // HF-Race Fix: Wait for Vault Unlock before touching storage
        await this.localDb.readyPromise;

        const id = this.auth.getUserId();
        if (!id) return null;

        // 1. Try Cache First for instant UI
        const cached = await this.storage.getMeta('profile_data');
        if (cached && this.normalizeId(cached.user_id) === id) {
            console.log('[Profile] Loaded from cache');
            // Background sync
            this.syncProfileInBackground(id);
            return cached;
        }

        return await this.syncProfileInBackground(id);
    }

    getUserProfile(userId: string) {
        return this.api.get(`profile.php?user_id=${this.normalizeId(userId)}`);
    }

    private async syncProfileInBackground(id: string) {
        const normId = this.normalizeId(id);
        try {
            const apiRes: any = await firstValueFrom(this.api.get(`profile.php?user_id=${normId}`));

            // Check if API returned valid data. 
            if (!apiRes || !apiRes.first_name || !apiRes.phone_number) {
                this.logger.warn(`[Profile] API profile incomplete for ${id}, checking Firestore fallback...`, apiRes);
                const db = this.firestoreGetInstance();
                const docSnap = await this.firestoreGetDoc(this.firestoreDoc(db, 'users', id));
                if (docSnap.exists()) {
                    const firestoreData = docSnap.data() as any;
                    this.logger.log("[Profile] Found in Firestore:", firestoreData);

                    // Merge logic: Favor API for core fields unless empty, but merge Firestore if API is missing parts
                    const merged = { ...apiRes, ...firestoreData, user_id: id };

                    // SECURITY: Ensure phone number is preserved if API has it (The Truth)
                    if (apiRes && apiRes.phone_number) {
                        merged.phone_number = apiRes.phone_number;
                    }

                    if (apiRes && apiRes.photo_url && (!firestoreData.photo_url || firestoreData.photo_url === '')) {
                        merged.photo_url = apiRes.photo_url;
                    } else if (apiRes && !apiRes.photo_url && firestoreData.photo_url) {
                        merged.photo_url = firestoreData.photo_url;
                    }

                    this.logger.log("[Profile] Final Merged Profile:", merged);
                    await this.storage.setMeta('profile_data', merged);
                    return merged;
                }
            }

            if (apiRes) {
                this.logger.log(`[ProfileService] Sync success for ${id}. photo_url: ${apiRes.photo_url}`);
                apiRes.user_id = id;
                await this.storage.setMeta('profile_data', apiRes);
            }
            return apiRes;
        } catch (e) {
            this.logger.error("[Profile] Sync Error", e);
            return await this.storage.getMeta('profile_data');
        }
    }

    async updateProfile(profileData: any) {
        const id = this.auth.getUserId();

        // 1. Update MySQL (Legacy/API) - Primary, must complete
        const result = await firstValueFrom(this.api.post('profile.php', { ...profileData, user_id: id }));

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
        return firstValueFrom(this.api.post('register.php', { email, phone_number: newPhone, action: 'phone_update' }));
    }

    async verifyPhoneUpdate(email: string, otp: string) {
        return firstValueFrom(this.api.post('profile.php', {
            action: 'verify_phone_otp',
            email: email,
            otp: otp
        }));
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
        try {
            return await getDoc(ref);
        } catch (e: any) {
            if (e.message?.includes('offline') || e.code === 'unavailable') {
                return { exists: () => false, data: () => undefined };
            }
            throw e;
        }
    }

    protected firestoreDoc(ref: any, ...paths: string[]) {
        return (doc as any)(ref, ...paths);
    }
}
