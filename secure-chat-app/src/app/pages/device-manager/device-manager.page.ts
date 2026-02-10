import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { DeviceService, Device, AuditEvent } from '../../services/device.service';

@Component({
    selector: 'app-device-manager',
    templateUrl: './device-manager.page.html',
    styleUrls: ['./device-manager.page.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class DeviceManagerPage implements OnInit {
    private deviceService = inject(DeviceService);
    private alertCtrl = inject(AlertController);

    devices: Device[] = [];
    auditEvents: AuditEvent[] = [];
    selectedTab: 'devices' | 'audit' = 'devices';
    loading = false;

    ngOnInit() {
        this.loadDevices();
    }

    async loadDevices() {
        this.loading = true;
        this.devices = await this.deviceService.listDevices();
        this.loading = false;
    }

    async loadAuditLogs() {
        this.loading = true;
        this.auditEvents = await this.deviceService.getAuditLogs(50);
        this.loading = false;
    }

    async onTabChange(tab: 'devices' | 'audit') {
        this.selectedTab = tab;
        if (tab === 'audit' && this.auditEvents.length === 0) {
            await this.loadAuditLogs();
        }
    }

    async confirmRevoke(device: Device) {
        if (device.is_current) {
            // Current device - need force logout confirmation
            const alert = await this.alertCtrl.create({
                header: 'Logout This Device?',
                message: 'You will be logged out and need to sign in again.',
                buttons: [
                    { text: 'Cancel', role: 'cancel' },
                    { text: 'Logout', role: 'destructive', handler: () => this.revokeDevice(device, true) }
                ]
            });
            await alert.present();
        } else {
            const alert = await this.alertCtrl.create({
                header: 'Revoke Device?',
                message: `Remove "${device.device_name || device.platform}" from your account?`,
                buttons: [
                    { text: 'Cancel', role: 'cancel' },
                    { text: 'Revoke', role: 'destructive', handler: () => this.revokeDevice(device, false) }
                ]
            });
            await alert.present();
        }
    }

    async revokeDevice(device: Device, forceLogout: boolean) {
        const success = await this.deviceService.revokeDevice(device.device_uuid, forceLogout);
        if (success) {
            await this.loadDevices();
            await this.loadAuditLogs();
        }
    }

    getPlatformIcon(platform: string): string {
        switch (platform?.toLowerCase()) {
            case 'android': return 'logo-android';
            case 'ios': return 'logo-apple';
            case 'web': return 'globe-outline';
            default: return 'phone-portrait-outline';
        }
    }

    getEventIcon(eventType: string): string {
        switch (eventType) {
            case 'LOGIN': return 'log-in-outline';
            case 'REGISTER': return 'add-circle-outline';
            case 'REVOKE': return 'close-circle-outline';
            case 'TOKEN_REFRESH': return 'refresh-outline';
            case 'LOGOUT': return 'log-out-outline';
            default: return 'ellipse-outline';
        }
    }

    getEventColor(eventType: string): string {
        switch (eventType) {
            case 'LOGIN': return 'success';
            case 'REGISTER': return 'primary';
            case 'REVOKE': return 'danger';
            case 'TOKEN_REFRESH': return 'warning';
            case 'LOGOUT': return 'medium';
            default: return 'medium';
        }
    }
}
