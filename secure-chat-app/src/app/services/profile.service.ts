import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

@Injectable({
    providedIn: 'root'
})
export class ProfileService {

    constructor(private api: ApiService, private auth: AuthService, private logger: LoggingService) { }

    async getProfile() {
        // We use the ID from localStorage as it's more reliable than the observable in some flows
        const id = localStorage.getItem('user_id');
        if (!id) return null;

        try {
            const apiRes: any = await this.api.get(`profile.php?user_id=${id}`).toPromise();

            // Check if API returned valid data. 
            // If first_name is empty, it might be missing in MySQL but exist in Firestore (Sync gap).
            if (!apiRes || !apiRes.first_name) {
                this.logger.log("[Profile] API profile incomplete, checking Firestore fallback...");
                const db = this.firestoreGetInstance();
                const docSnap = await this.firestoreGetDoc(this.firestoreDoc(db, 'users', id));
                if (docSnap.exists()) {
                    const firestoreData = docSnap.data();
                    this.logger.log("[Profile] Found in Firestore:", firestoreData);
                    return { ...apiRes, ...(firestoreData as any) };
                }
            }
            return apiRes;
        } catch (e) {
            this.logger.error("[Profile] Get Error", e);
            // Fallback to Firestore on API error too?
            try {
                const db = this.firestoreGetInstance();
                const docSnap = await this.firestoreGetDoc(this.firestoreDoc(db, 'users', id));
                if (docSnap.exists()) {
                    return docSnap.data();
                }
            } catch (inner) {
                this.logger.error("[Profile] Firestore Fallback Error", inner);
            }
            return null;
        }
    }

    async updateProfile(profileData: any) {
        const id = localStorage.getItem('user_id');

        // 1. Update MySQL (Legacy/API)
        const apiPromise = this.api.post('profile.php', { ...profileData, user_id: id }).toPromise();

        // 2. Update Firestore (Sync for CallService)
        if (id) {
            try {
                const db = this.firestoreGetInstance();
                const userRef = this.firestoreDoc(db, 'users', id);
                const username = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Unknown';

                await setDoc(userRef, {
                    first_name: profileData.first_name || '',
                    last_name: profileData.last_name || '',
                    short_note: profileData.short_note || '',
                    photo_url: profileData.photo_url || '',
                    username: username, // Important for CallService display
                    updated_at: Date.now()
                }, { merge: true });

                this.logger.log("[Profile] Synced to Firestore for user:", id);
            } catch (e) {
                this.logger.error("[Profile] Failed to sync to Firestore", e);
            }
        }

        return apiPromise;
    }

    async uploadPhoto(formData: FormData) {
        // Direct fetch to upload.php to avoid interceptor issues with FormData
        try {
            const response = await fetch('https://chat.snapflect.com/api/upload.php', {
                method: 'POST',
                body: formData
            });
            const json = await response.json();
            return json.url; // Returns "uploads/xxxx.jpg"
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
