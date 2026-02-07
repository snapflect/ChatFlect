import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController, NavController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { DeviceService, DeviceInfo } from 'src/app/services/device.service';

@Component({
  selector: 'app-linked-devices',
  templateUrl: './linked-devices.page.html',
  styleUrls: ['./linked-devices.page.scss'],
  standalone: false
})
export class LinkedDevicesPage implements OnInit {
  devices: DeviceInfo[] = [];
  currentDeviceUuid: string = '';
  isLoading = true;
  currentUserId: string | null = null;

  constructor(
    private deviceService: DeviceService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private auth: AuthService,
    private nav: NavController
  ) { }

  ngOnInit() {
    this.currentDeviceUuid = localStorage.getItem('device_uuid') || '';
    this.auth.currentUserId.subscribe(id => {
      this.currentUserId = id;
      if (id) {
        this.loadDevices(id);
      }
    });
  }

  loadDevices(userId: string) {
    this.isLoading = true;
    this.deviceService.listDevices(userId).subscribe(
      (data: any) => { // Fix: Explicit any cast or align Types
        this.devices = (data as DeviceInfo[]) || [];
        // Sort: Pending first (Action needed), then Active, then Revoked
        this.devices.sort((a, b) => {
          const score = (status: string) => {
            if (status === 'pending') return 0;
            if (status === 'active') return 1;
            return 2;
          };
          // Sort by status score, then by most recently active
          const statusDiff = score(a.status) - score(b.status);
          if (statusDiff !== 0) return statusDiff;

          return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
        });
        this.isLoading = false;
      },
      (err) => {
        console.error(err);
        this.isLoading = false;
      }
    );
  }

  getFingerprint(device: DeviceInfo): string {
    if (device.signing_public_key) {
      // Show last 8 chars of Key Base64
      return '...' + device.signing_public_key.slice(-8);
    }
    return 'Legacy (No Key)';
  }


  goBack() {
    this.nav.back();
  }

  async confirmRevoke(device: DeviceInfo) {
    const alert = await this.alertCtrl.create({
      header: 'Revoke Device?',
      message: `Are you sure you want to log out ${device.device_name}? This will delete all keys and sessions for this device.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Revoke',
          role: 'destructive',
          handler: () => this.revokeDevice(device)
        }
      ]
    });
    await alert.present();
  }

  async approveDevice(device: DeviceInfo) {
    this.deviceService.approveDevice(device.device_uuid).subscribe(async () => {
      const toast = await this.toastCtrl.create({ message: 'Device approved successfully', duration: 2000, color: 'success' });
      toast.present();
      if (this.currentUserId) this.loadDevices(this.currentUserId);
    }, async (err) => {
      const toast = await this.toastCtrl.create({ message: 'Approval failed: ' + (err.error?.error || 'Unknown error'), duration: 3000 });
      toast.present();
    });
  }

  async revokeDevice(device: DeviceInfo) {
    if (!this.currentUserId) return;

    this.deviceService.revokeDevice(this.currentUserId, device.device_uuid).subscribe(async () => {
      const toast = await this.toastCtrl.create({ message: 'Device revoked and wiped successfully', duration: 2000 });
      toast.present();
      this.loadDevices(this.currentUserId!);
    }, async (err) => {
      const toast = await this.toastCtrl.create({ message: 'Failed to revoke device: ' + (err.error?.error || 'Unknown error'), duration: 3000 });
      toast.present();
    });
  }
}
