import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface DeviceInfo {
    device_uuid: string;
    device_name: string;
    last_active: string;
    created_at: string;
    libsignal_device_id: number;
    status: 'active' | 'pending' | 'revoked'; // v4.1 Schema
}

@Injectable({
    providedIn: 'root'
})
export class DeviceService {

    constructor(private api: ApiService) { }

    listDevices(userId: string): Observable<DeviceInfo[]> {
        return this.api.get(`devices.php?action=list&user_id=${userId}`);
    }

    revokeDevice(userId: string, deviceUuid: string): Observable<any> {
        return this.api.post('v3/revoke_device.php', {
            user_id: userId, // Optional, depending on strict backend check
            device_uuid: deviceUuid
        });
    }

    // Future: Story 4.3 Approve Device
    approveDevice(deviceUuid: string): Observable<any> {
        return this.api.post('v3/approve_device.php', {
            device_uuid: deviceUuid
        });
    }
}
