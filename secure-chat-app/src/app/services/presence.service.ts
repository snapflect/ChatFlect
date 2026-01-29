import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { AppState } from '@capacitor/app';
import { Observable, BehaviorSubject } from 'rxjs';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class PresenceService {
    private db: any;
    private myId: string | null = null;

    // Throttling & State Tracking (v10)
    private lastPresenceState: string | null = null;
    private lastPresenceWriteTime: number = 0;
    private readonly HEARTBEAT_INTERVAL = 600000; // 10 minutes (Firestore Cost Optimization)

    private lastTypingWriteTime: Map<string, number> = new Map();
    private readonly TYPING_THROTTLE_MS = 15000; // 15 seconds

    constructor(private logger: LoggingService) {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);
        this.myId = localStorage.getItem('user_id');
    }

    /**
     * Initialize automatic presence tracking (v10)
     */
    initPresenceTracking() {
        if (!this.myId) return;

        // 1. Initial online status
        this.setPresence('online');

        // 2. Listen for App State changes
        const { App } = require('@capacitor/app');
        App.addListener('appStateChange', (state: { isActive: boolean }) => {
            if (state.isActive) {
                this.setPresence('online');
            } else {
                this.setPresence('offline');
            }
        });

        // 3. Heartbeat-based presence reconciliation (v10)
        // Convergence: If app crashes/network drops, heartbeat expires on server.
        setInterval(() => {
            if (this.lastPresenceState === 'online') {
                this.setPresence('online', true); // Force heartbeat even if state same
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    // Set Global Online Status
    async setPresence(status: 'online' | 'offline', isHeartbeat: boolean = false) {
        if (!this.myId) return;

        const now = Date.now();
        // Optimization: Avoid redundant writes if state hasn't changed, unless it's a heartbeat (v10)
        if (!isHeartbeat && status === this.lastPresenceState && (now - this.lastPresenceWriteTime < 60000)) {
            return;
        }

        try {
            const userStatusRef = doc(this.db, 'status', this.myId);
            const payload = {
                state: status,
                last_changed: serverTimestamp(),
                platform: 'mobile',
                heartbeat: serverTimestamp() // v10: Server-side TTL hint
            };
            await setDoc(userStatusRef, payload, { merge: true });

            this.lastPresenceState = status;
            this.lastPresenceWriteTime = now;
        } catch (e) {
            this.logger.error('Error setting presence', e);
        }
    }

    // Watch another user's status
    getPresence(userId: string): Observable<any> {
        return new Observable(observer => {
            const docRef = doc(this.db, 'status', userId);
            const unsub = onSnapshot(docRef, (doc) => {
                observer.next(doc.data() || { state: 'offline' });
            });
            return () => unsub();
        });
    }

    /**
     * Typing Indicators (v10): Throttled to 1 write / 15s per chat
     */
    async setTyping(chatId: string, isTyping: boolean) {
        if (!this.myId) return;

        const now = Date.now();
        const lastWrite = this.lastTypingWriteTime.get(chatId) || 0;

        // Throttle check for 'true' status. 'false' (cleanup) always permitted.
        if (isTyping && (now - lastWrite < this.TYPING_THROTTLE_MS)) {
            return;
        }

        try {
            const chatRef = doc(this.db, 'chats', chatId);
            if (isTyping) {
                await updateDoc(chatRef, {
                    [`typing.${this.myId}`]: serverTimestamp()
                });
                this.lastTypingWriteTime.set(chatId, now);
            } else {
                await updateDoc(chatRef, {
                    [`typing.${this.myId}`]: deleteField()
                });
                this.lastTypingWriteTime.delete(chatId);
            }
        } catch (e) { }
    }

    private typingDebounceTimer: any = null;

    /**
     * High-performance debounced typing indicator (v10 Throttled)
     */
    sendTypingDebounced(chatId: string) {
        if (this.typingDebounceTimer) {
            clearTimeout(this.typingDebounceTimer);
        }

        this.setTyping(chatId, true);

        this.typingDebounceTimer = setTimeout(() => {
            this.setTyping(chatId, false);
            this.typingDebounceTimer = null;
        }, 5000); // Reset after 5s of inactivity
    }

    /**
     * Force clear typing (e.g. after sending message)
     */
    clearTyping(chatId: string) {
        if (this.typingDebounceTimer) {
            clearTimeout(this.typingDebounceTimer);
            this.typingDebounceTimer = null;
        }
        this.setTyping(chatId, false);
    }
}
