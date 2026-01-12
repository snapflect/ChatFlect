import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggingService } from './logging.service';

export interface ChatSettings {
    pinned: boolean;
    muted: number; // 0 = not muted, otherwise timestamp when mute expires (or -1 for forever)
    archived: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ChatSettingsService {
    private db: any;
    private myId: string | null = null;

    // Local cache of settings
    private settingsCache = new Map<string, ChatSettings>();
    private settingsSubject = new BehaviorSubject<Map<string, ChatSettings>>(new Map());

    constructor(private logger: LoggingService) {
        try {
            const app = initializeApp(environment.firebase);
            this.db = getFirestore(app);
            this.myId = localStorage.getItem('user_id');
        } catch (e) {
            // App may already be initialized
            this.db = getFirestore();
            this.myId = localStorage.getItem('user_id');
        }
    }

    /**
     * Get settings for a specific chat
     */
    getSettings(chatId: string): ChatSettings {
        return this.settingsCache.get(chatId) || { pinned: false, muted: 0, archived: false };
    }

    /**
     * Check if a chat is pinned
     */
    isPinned(chatId: string): boolean {
        return this.getSettings(chatId).pinned;
    }

    /**
     * Check if a chat is muted
     */
    isMuted(chatId: string): boolean {
        const muted = this.getSettings(chatId).muted;
        if (muted === 0) return false;
        if (muted === -1) return true; // Forever
        return Date.now() < muted; // Check if mute hasn't expired
    }

    /**
     * Check if a chat is archived
     */
    isArchived(chatId: string): boolean {
        return this.getSettings(chatId).archived;
    }

    /**
     * Toggle pin status for a chat
     */
    async togglePin(chatId: string): Promise<void> {
        if (!this.myId || !this.db) return;

        const current = this.getSettings(chatId);
        const newPinned = !current.pinned;

        try {
            const docRef = doc(this.db, 'users', this.myId, 'chatSettings', chatId);
            await setDoc(docRef, { pinned: newPinned }, { merge: true });

            // Update local cache
            this.settingsCache.set(chatId, { ...current, pinned: newPinned });
            this.settingsSubject.next(this.settingsCache);
        } catch (e) {
            this.logger.error('Error toggling pin', e);
        }
    }

    /**
     * Toggle mute status for a chat
     * @param duration - 0 to unmute, -1 for forever, otherwise milliseconds to mute
     */
    async toggleMute(chatId: string, duration: number = -1): Promise<void> {
        if (!this.myId || !this.db) return;

        const current = this.getSettings(chatId);
        const isMutedNow = this.isMuted(chatId);
        const newMuted = isMutedNow ? 0 : (duration === -1 ? -1 : Date.now() + duration);

        try {
            const docRef = doc(this.db, 'users', this.myId, 'chatSettings', chatId);
            await setDoc(docRef, { muted: newMuted }, { merge: true });

            // Update local cache
            this.settingsCache.set(chatId, { ...current, muted: newMuted });
            this.settingsSubject.next(this.settingsCache);
        } catch (e) {
            this.logger.error('Error toggling mute', e);
        }
    }

    /**
     * Toggle archive status for a chat
     */
    async toggleArchive(chatId: string): Promise<void> {
        if (!this.myId || !this.db) return;

        const current = this.getSettings(chatId);
        const newArchived = !current.archived;

        try {
            const docRef = doc(this.db, 'users', this.myId, 'chatSettings', chatId);
            await setDoc(docRef, { archived: newArchived }, { merge: true });

            // Update local cache
            this.settingsCache.set(chatId, { ...current, archived: newArchived });
            this.settingsSubject.next(this.settingsCache);
        } catch (e) {
            this.logger.error('Error toggling archive', e);
        }
    }

    /**
     * Load settings for a specific chat from Firestore
     */
    async loadSettings(chatId: string): Promise<ChatSettings> {
        if (!this.myId || !this.db) {
            return { pinned: false, muted: 0, archived: false };
        }

        try {
            const docRef = doc(this.db, 'users', this.myId, 'chatSettings', chatId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as ChatSettings;
                const settings = {
                    pinned: data.pinned || false,
                    muted: data.muted || 0,
                    archived: data.archived || false
                };
                this.settingsCache.set(chatId, settings);
                return settings;
            }
        } catch (e) {
            this.logger.error('Error loading settings', e);
        }

        return { pinned: false, muted: 0, archived: false };
    }

    /**
     * Load settings for multiple chats (batch)
     */
    async loadMultipleSettings(chatIds: string[]): Promise<void> {
        let changed = false;
        for (const chatId of chatIds) {
            const old = JSON.stringify(this.settingsCache.get(chatId));
            const fresh = await this.loadSettings(chatId);
            if (JSON.stringify(fresh) !== old) {
                changed = true;
            }
        }
        if (changed) {
            this.settingsSubject.next(new Map(this.settingsCache));
        }
    }

    /**
     * Observable for settings changes
     */
    get settings$(): Observable<Map<string, ChatSettings>> {
        return this.settingsSubject.asObservable();
    }
}
