import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';

export interface SecurityAlert {
    id: number;
    alert_type: 'NEW_DEVICE_LOGIN' | 'DEVICE_REVOKED' | 'IP_CHANGE' | 'ABUSE_LOCK' | 'RATE_LIMIT_BLOCK';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    device_uuid: string | null;
    ip_address: string | null;
    metadata: any;
    is_read: number;
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class SecurityAlertsService {
    private api = inject(ApiService);

    private _unreadCount$ = new BehaviorSubject<number>(0);
    unreadCount$ = this._unreadCount$.asObservable();

    /**
     * Fetch security alerts
     */
    async getAlerts(limit: number = 50, unreadOnly: boolean = false): Promise<SecurityAlert[]> {
        try {
            let url = `/v4/security/alerts.php?limit=${limit}`;
            if (unreadOnly) url += '&unread=1';

            const res = await this.api.get(url).toPromise();
            this._unreadCount$.next((res as any).unread_count || 0);
            return (res as any).alerts || [];
        } catch (e) {
            console.error('[SecurityAlertsService] getAlerts error:', e);
            return [];
        }
    }

    /**
     * Mark an alert as read
     */
    async markRead(alertId: number): Promise<boolean> {
        try {
            const res = await this.api.post('/v4/security/alerts_read.php', {
                alert_id: alertId
            }).toPromise();
            if ((res as any).success) {
                this._unreadCount$.next(Math.max(0, this._unreadCount$.value - 1));
            }
            return (res as any).success || false;
        } catch (e) {
            console.error('[SecurityAlertsService] markRead error:', e);
            return false;
        }
    }

    /**
     * Get alert display info
     */
    getAlertInfo(type: string): { icon: string; color: string; title: string } {
        switch (type) {
            case 'NEW_DEVICE_LOGIN':
                return { icon: 'phone-portrait-outline', color: 'warning', title: 'New Device Login' };
            case 'DEVICE_REVOKED':
                return { icon: 'close-circle-outline', color: 'success', title: 'Device Revoked' };
            case 'IP_CHANGE':
                return { icon: 'location-outline', color: 'warning', title: 'IP Address Changed' };
            case 'ABUSE_LOCK':
                return { icon: 'lock-closed-outline', color: 'danger', title: 'Account Locked' };
            case 'RATE_LIMIT_BLOCK':
                return { icon: 'warning-outline', color: 'warning', title: 'Rate Limited' };
            default:
                return { icon: 'alert-circle-outline', color: 'medium', title: 'Security Alert' };
        }
    }
}
