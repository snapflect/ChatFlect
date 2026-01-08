import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';

@Injectable({
    providedIn: 'root'
})
export class BackupService {

    constructor(
        private api: ApiService,
        private auth: AuthService,
        private crypto: CryptoService
    ) { }

    async createBackup(): Promise<Blob> {
        // 1. Gather LocalStorage Data (Keys are critical)
        const data: any = {
            version: 1,
            date: new Date().toISOString(),
            keys: {
                private_key: localStorage.getItem('private_key'),
                public_key: localStorage.getItem('public_key'),
                user_id: localStorage.getItem('user_id'),
                firstName: localStorage.getItem('firstName'),
                lastName: localStorage.getItem('lastName'),
                photoUrl: localStorage.getItem('photoUrl')
            },
            // Future: Export cached messages?
        };

        // 2. Encrypt? 
        // Ideally, we encrypt this JSON with a user-provided password before export.
        // For MVP, we'll export plainly but warn user "Keep this file safe".
        // Or we can encrypt with a fixed "Export Key" if we want to obscure it, but password is best.
        // Let's stick to JSON for now for simplicity of "Restore".

        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        return blob;
    }

    async restoreBackup(jsonString: string): Promise<boolean> {
        try {
            const data = JSON.parse(jsonString);
            if (!data.keys || !data.keys.private_key) {
                throw new Error("Invalid Backup File");
            }

            // Restore Keys
            localStorage.setItem('private_key', data.keys.private_key);
            localStorage.setItem('public_key', data.keys.public_key);
            localStorage.setItem('user_id', data.keys.user_id);

            if (data.keys.firstName) localStorage.setItem('firstName', data.keys.firstName);
            if (data.keys.lastName) localStorage.setItem('lastName', data.keys.lastName);
            if (data.keys.photoUrl) localStorage.setItem('photoUrl', data.keys.photoUrl);

            // Force reload or re-auth?
            return true;
        } catch (e) {
            console.error("Restore failed", e);
            return false;
        }
    }
}
