import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Device {
    device_uuid: string;
    device_name: string;
    platform: string;
    status: 'active' | 'revoked';
    last_seen: string | null;
    registered_at: string;
    is_current: boolean;
    app_version?: string;
    signing_public_key?: string;
}

export interface AuditEvent {
    event_type: 'LOGIN' | 'REGISTER' | 'REVOKE' | 'TOKEN_REFRESH' | 'LOGOUT';
    device_uuid: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    metadata?: any;
}

@Injectable({
    providedIn: 'root'
})
export class DeviceService {
    private api = inject(ApiService);

    /**
     * List all devices for the current user
     */
    async listDevices(): Promise<Device[]> {
        try {
            const res = await this.api.get('/v4/devices/list.php').toPromise();
            return (res as any).devices || [];
        } catch (e) {
            console.error('[DeviceService] listDevices error:', e);
            return [];
        }
    }

    /**
     * Revoke a device
     * @param deviceUuid Target device to revoke
     * @param forceLogout If revoking current device, must be true
     */
    async revokeDevice(deviceUuid: string, forceLogout: boolean = false): Promise<boolean> {
        try {
            const res = await this.api.post('/v4/devices/revoke.php', {
                device_uuid: deviceUuid,
                force_logout: forceLogout
            }).toPromise();
            return (res as any).success || false;
        } catch (e) {
            console.error('[DeviceService] revokeDevice error:', e);
            return false;
        }
    }

    /**
     * Get audit history for current user
     * @param limit Max number of events (default 50)
     * @param deviceUuid Optional filter by device
     */
    async getAuditLogs(limit: number = 50, deviceUuid?: string): Promise<AuditEvent[]> {
        try {
            let url = `/v4/devices/audit.php?limit=${limit}`;
            if (deviceUuid) {
                url += `&device_uuid=${deviceUuid}`;
            }
            const res = await this.api.get(url).toPromise();
            return (res as any).events || [];
        } catch (e) {
            console.error('[DeviceService] getAuditLogs error:', e);
            return [];
        }
    }
    async approveDevice(deviceUuid: string): Promise<boolean> {
        try {
            const res = await this.api.post('/v4/devices/approve.php', {
                device_uuid: deviceUuid
            }).toPromise();
            return (res as any).success || false;
        } catch (e) {
            console.error('[DeviceService] approveDevice error:', e);
            return false;
        }
    }
}

export type DeviceInfo = Device;
