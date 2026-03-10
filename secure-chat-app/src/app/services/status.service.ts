import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, throttleTime } from 'rxjs/operators';
import { LocalDbService } from './local-db.service';
@Injectable({
    providedIn: 'root'
})
export class StatusService {
    // Local storage key for viewed statuses
    private readonly VIEWED_KEY = 'viewed_status_ids';
    private readonly MUTED_KEY = 'muted_status_users';

    // Observable for muted users
    private mutedUsersSubject = new BehaviorSubject<string[]>([]);
    public mutedUsers$ = this.mutedUsersSubject.asObservable();

    // Reactive Status Feed
    private statusSubject = new BehaviorSubject<any[]>([]);
    public statuses$ = this.statusSubject.asObservable();

    // Enterprise Push Trigger Deduplication
    private refreshTrigger = new Subject<void>();
    private refreshInProgress: boolean = false;

    constructor(private api: ApiService, private localDb: LocalDbService) {
        this.loadMutedUsers();

        // HF Phase 2: Debounce and throttle push events
        this.refreshTrigger.pipe(
            debounceTime(3000),
            throttleTime(10000)
        ).subscribe(() => {
            this.executeFetch(true);
        });
    }

    async refreshFeed() {
        // Fast UI render from SQLite
        await this.loadFromCache();

        // Push actual network fetch through the debounce engine
        this.refreshTrigger.next();
    }

    private async loadFromCache() {
        try {
            const res = await this.localDb.query<{ feed_data: string, cache_time: number }>("SELECT feed_data, cache_time FROM status_cache WHERE id = 1");
            if (res.length > 0 && res[0].feed_data) {
                const data = JSON.parse(res[0].feed_data);
                this.statusSubject.next(data);
            }
        } catch (e) {
            console.error('[StatusService] Cache load fail', e);
        }
    }

    private async executeFetch(force: boolean = false) {
        if (this.refreshInProgress) return;

        try {
            const res = await this.localDb.query<{ feed_data: string, cache_time: number }>("SELECT feed_data, cache_time FROM status_cache WHERE id = 1");
            if (!force && res.length > 0) {
                const age = Date.now() - res[0].cache_time;
                if (age < 5 * 60 * 1000) {
                    return; // Cache still valid
                }
            }
        } catch (e) { }

        this.refreshInProgress = true;
        const uid = localStorage.getItem('user_id') || '';

        this.api.get(`status.php?action=feed&user_id=${uid}`).subscribe({
            next: async (res: any) => {
                if (Array.isArray(res)) {
                    this.statusSubject.next(res);
                    // Update SQLite Cache efficiently without SQL injection risks using parametrized queries
                    try {
                        const dataStr = JSON.stringify(res);
                        await this.localDb.run(`
                            INSERT INTO status_cache (id, feed_data, cache_time) 
                            VALUES (1, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET 
                                feed_data=excluded.feed_data, 
                                cache_time=excluded.cache_time;
                        `, [dataStr, Date.now()]);
                    } catch (e) {
                        console.error('[StatusService] Cache write fail', e);
                    }
                }
                this.refreshInProgress = false;
            },
            error: () => {
                this.refreshInProgress = false;
            }
        });
    }

    // Load muted users from server
    loadMutedUsers() {
        const userId = localStorage.getItem('user_id');
        if (userId) {
            this.getMutedUsers(userId).subscribe((users: any) => {
                const mutedIds = Array.isArray(users) ? users as string[] : [];
                this.mutedUsersSubject.next(mutedIds);
                localStorage.setItem(this.MUTED_KEY, JSON.stringify(mutedIds));
            });
        }
    }

    getFeed(userId?: string) {
        const uid = userId || localStorage.getItem('user_id') || '';
        return this.api.get(`status.php?action=feed&user_id=${uid}`);
    }

    // Upload Media Status (Image/Video/Audio)
    uploadStatus(file: File, caption: string, type: 'image' | 'video' | 'audio' = 'image', privacy: string = 'everyone') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        formData.append('caption', caption);
        formData.append('privacy', privacy);
        formData.append('user_id', localStorage.getItem('user_id') || '');

        return new Observable(observer => {
            this.api.post('status.php', formData).subscribe({
                next: (res) => {
                    this.refreshFeed(); // Auto-refresh
                    observer.next(res);
                    observer.complete();
                },
                error: (err) => observer.error(err)
            });
        });
    }

    // Upload Text Status
    uploadTextStatus(text: string, bgColor: string, font: string, privacy: string = 'everyone') {
        const formData = new FormData();
        formData.append('type', 'text');
        formData.append('text_content', text);
        formData.append('background_color', bgColor);
        formData.append('font', font);
        formData.append('privacy', privacy);
        formData.append('user_id', localStorage.getItem('user_id') || '');

        return new Observable(observer => {
            this.api.post('status.php', formData).subscribe({
                next: (res) => {
                    this.refreshFeed(); // Auto-refresh
                    observer.next(res);
                    observer.complete();
                },
                error: (err) => observer.error(err)
            });
        });
    }

    // Record View
    recordView(statusId: string) {
        return this.api.post('status.php?action=view', {
            status_id: statusId,
            viewer_id: localStorage.getItem('user_id')
        });
    }

    // ==================== PREFETCHING ====================
    // Silent background prefetcher for zero-latency UX
    prefetchFeedMedia(users: any[]) {
        if (!users || users.length === 0) return;

        // HF Phase 9: Network Awareness Bandwidth Guard
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (connection) {
            const type = connection.effectiveType;
            if (type === '2g' || type === 'slow-2g') {
                console.log('Status: Skipping prefetch to save bandwidth on slow network:', type);
                return;
            }
        }

        // Preload next 2 users' unviewed statuses
        const toPrefetch = users.slice(0, 2);

        toPrefetch.forEach(user => {
            if (user.updates && user.updates.length > 0) {
                const firstUnviewed = user.updates.find((u: any) => !this.isViewed(u.id)) || user.updates[0];

                if (firstUnviewed && firstUnviewed.media_url && firstUnviewed.type === 'image') {
                    const img = new Image();
                    img.src = firstUnviewed.media_url;
                } else if (firstUnviewed && firstUnviewed.media_url && firstUnviewed.type === 'video') {
                    // Preload video metadata
                    const vid = document.createElement('video');
                    vid.preload = 'metadata';
                    vid.src = firstUnviewed.media_url;
                }
            }
        });
    }

    // Get Viewers
    getViewers(statusId: string) {
        return this.api.get(`status.php?action=viewers&status_id=${statusId}`);
    }

    // Delete Status
    deleteStatus(statusId: string) {
        return new Observable(observer => {
            this.api.post('status.php?action=delete', {
                status_id: statusId,
                user_id: localStorage.getItem('user_id')
            }).subscribe({
                next: (res) => {
                    // Optimistic update
                    const current = this.statusSubject.value;
                    // Note: Flat list or grouped? The feed returns a flat list of User objects with updates?
                    // Actually the feed returns a list of USERS with 'updates' array usually.
                    // Wait, let's check the API response format in status.php.
                    // status.php 'feed' action returns flat list of status_updates rows joined with users.
                    // It returns `echo json_encode($feed);` where $feed is array of rows.
                    // StatusPage `loadStatus` formats this into `StatusUser` objects.
                    // So `statusSubject` holds raw rows or processed?
                    // My `refreshFeed` implementation above does strictly `this.statusSubject.next(res)`.
                    // So it holds RAW rows.
                    // Optimistic update for raw rows:
                    // const filtered = current.filter((s: any) => s.id != statusId);
                    // this.statusSubject.next(filtered);
                    this.refreshFeed(); // Safe fallback
                    observer.next(res);
                    observer.complete();
                },
                error: (err) => observer.error(err)
            });
        });
    }

    // Mute/Unmute a user's status
    muteUser(mutedUserId: string, mute: boolean = true): Observable<any> {
        return new Observable(observer => {
            this.api.post('status.php?action=mute', {
                user_id: localStorage.getItem('user_id'),
                muted_user_id: mutedUserId,
                mute: mute
            }).subscribe({
                next: (res) => {
                    // Update local cache
                    const current = this.mutedUsersSubject.value;
                    if (mute && !current.includes(mutedUserId)) {
                        this.mutedUsersSubject.next([...current, mutedUserId]);
                    } else if (!mute) {
                        this.mutedUsersSubject.next(current.filter(id => id !== mutedUserId));
                    }
                    localStorage.setItem(this.MUTED_KEY, JSON.stringify(this.mutedUsersSubject.value));
                    observer.next(res);
                    observer.complete();
                },
                error: (err) => observer.error(err)
            });
        });
    }

    // Get Muted Users
    getMutedUsers(userId?: string) {
        const uid = userId || localStorage.getItem('user_id') || '';
        return this.api.get(`status.php?action=muted&user_id=${uid}`);
    }

    // Check if user is muted
    isUserMuted(userId: string): boolean {
        return this.mutedUsersSubject.value.includes(userId);
    }

    // Track viewed status locally
    markAsViewed(statusId: string) {
        const viewed = this.getViewedIds();
        if (!viewed.includes(statusId)) {
            viewed.push(statusId);
            localStorage.setItem(this.VIEWED_KEY, JSON.stringify(viewed));
        }
    }

    // Get locally viewed status IDs
    getViewedIds(): string[] {
        try {
            return JSON.parse(localStorage.getItem(this.VIEWED_KEY) || '[]');
        } catch {
            return [];
        }
    }

    // Check if status was viewed
    isViewed(statusId: string): boolean {
        return this.getViewedIds().includes(statusId);
    }

    // Clear old viewed entries (older than 24h would be auto-expired anyway)
    clearExpiredViewed() {
        // For simplicity, we just keep the last 500 entries
        const viewed = this.getViewedIds();
        if (viewed.length > 500) {
            localStorage.setItem(this.VIEWED_KEY, JSON.stringify(viewed.slice(-500)));
        }
    }

    // ==================== REACTIONS ====================

    // Available reactions (WhatsApp style)
    static readonly REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '🎉'];

    // React to a status
    reactToStatus(statusId: string, reaction: string) {
        return this.api.post('status.php?action=react', {
            status_id: statusId,
            user_id: localStorage.getItem('user_id'),
            reaction: reaction
        });
    }

    // Remove reaction from status
    unreactToStatus(statusId: string) {
        return this.api.post('status.php?action=unreact', {
            status_id: statusId,
            user_id: localStorage.getItem('user_id')
        });
    }

    // Get reactions for a status
    getReactions(statusId: string) {
        return this.api.get(`status.php?action=reactions&status_id=${statusId}`);
    }

    // ==================== REPLIES ====================

    // Reply to a status
    replyToStatus(statusId: string, message: string, replyType: 'text' | 'emoji' | 'sticker' = 'text') {
        return this.api.post('status.php?action=reply', {
            status_id: statusId,
            user_id: localStorage.getItem('user_id'),
            message: message,
            reply_type: replyType
        });
    }

    // Get replies for a status
    getReplies(statusId: string) {
        return this.api.get(`status.php?action=replies&status_id=${statusId}`);
    }
}

