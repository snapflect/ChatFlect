import { Injectable } from '@angular/core';

/**
 * Secure Deletion & Cleanup
 */
@Injectable({
    providedIn: 'root'
})
export class SecureDeleteService {

    constructor() { }

    async wipeAll(dbName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            req.onblocked = () => console.warn('DB Delete Blocked');
        });
    }

    // Future: Key Rotation Logic
}
