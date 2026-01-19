import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, Observable } from 'rxjs';

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

    constructor(private api: ApiService) {
        this.loadMutedUsers();
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

        return this.api.post('status.php', formData);
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

        return this.api.post('status.php', formData);
    }

    // Record View
    recordView(statusId: string) {
        return this.api.post('status.php?action=view', {
            status_id: statusId,
            viewer_id: localStorage.getItem('user_id')
        });
    }

    // Get Viewers
    getViewers(statusId: string) {
        return this.api.get(`status.php?action=viewers&status_id=${statusId}`);
    }

    // Delete Status
    deleteStatus(statusId: string) {
        return this.api.post('status.php?action=delete', {
            status_id: statusId,
            user_id: localStorage.getItem('user_id')
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

