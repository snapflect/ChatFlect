import { Injectable, OnDestroy } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Observable, Subscription } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PresenceService implements OnDestroy {
    private myId: string | null = null;
    private deviceUuid: string | null = null;

    // Heartbeat State
    private heartbeatInterval: any = null;
    private isVisible = true;
    private readonly FG_INTERVAL = 30000; // 30s
    private readonly BG_INTERVAL = 90000; // 90s (Battery Optimization)

    // Typing State
    private typingDebounceTimer: any = null;
    private lastTypingSent = 0;
    private readonly TYPING_THROTTLE_MS = 10000; // 10s server guard

    private authSub: Subscription;

    constructor(
        private api: ApiService, // Handles token injection automatically
        private auth: AuthService
    ) {
        this.authSub = this.auth.currentUserId.subscribe(uid => {
            this.myId = uid;
            if (uid) {
                this.initPresenceTracking();
            } else {
                this.stopPresenceTracking();
            }
        });

        this.deviceUuid = localStorage.getItem('device_uuid');
    }

    ngOnDestroy() {
        this.stopPresenceTracking();
        this.authSub?.unsubscribe();
    }

    initPresenceTracking() {
        if (!this.myId) return;

        // Visibility Listener
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Start Heartbeat
        this.isVisible = document.visibilityState === 'visible';
        this.updatePresence('online');
        this.restartHeartbeat();
    }

    private stopPresenceTracking() {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
    }

    private handleVisibilityChange = () => {
        const wasVisible = this.isVisible;
        this.isVisible = document.visibilityState === 'visible';

        if (this.isVisible !== wasVisible) {
            this.restartHeartbeat();
            if (this.isVisible) {
                this.updatePresence('online');
            }
        }
    }

    private restartHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        // Stop if offline
        if (!navigator.onLine || !this.myId) return;

        const interval = this.isVisible ? this.FG_INTERVAL : this.BG_INTERVAL;

        console.log(`[Presence] Heartbeat interval: ${interval}ms`);

        this.heartbeatInterval = setInterval(() => {
            this.updatePresence('online');
        }, interval);
    }

    // Main Update Method
    async updatePresence(status: 'online' | 'offline', typingInChat?: string) {
        if (!this.myId) return;

        // ApiService handles Auth header
        const payload: any = { status };
        if (typingInChat !== undefined) {
            payload.typing_in = typingInChat;
        }

        try {
            await this.api.post('presence/update.php', payload).toPromise();
        } catch (e) {
            console.warn('[Presence] Update failed', e);
        }
    }

    // Typing Logic
    setTyping(chatId: string, isTyping: boolean) {
        if (this.typingDebounceTimer) clearTimeout(this.typingDebounceTimer);

        if (isTyping) {
            // Throttled Send
            const now = Date.now();
            if (now - this.lastTypingSent > this.TYPING_THROTTLE_MS) {
                this.updatePresence('online', chatId);
                this.lastTypingSent = now;
            }

            // Auto-clear safety
            this.typingDebounceTimer = setTimeout(() => {
                this.setTyping(chatId, false);
            }, 5000); // 5s ephemeral per request
        } else {
            this.updatePresence('online', ''); // Clear typing
            this.lastTypingSent = 0;
        }
    }

    clearTyping(chatId: string) {
        this.setTyping(chatId, false);
    }

    // Phase 19.2: Batch Query Implementation
    // To be used by Contact List or Chat List
    getPresenceBatch(userIds: string[]): Observable<any> {
        return this.api.post('presence/query.php', { user_ids: userIds });
    }
}
