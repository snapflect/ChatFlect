import { Component, OnInit } from '@angular/core';
import { ApiService } from 'src/app/services/api.service';
import { AlertController, ToastController, NavController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-linked-devices',
  templateUrl: './linked-devices.page.html',
  styleUrls: ['./linked-devices.page.scss'],
  standalone: false
})
export class LinkedDevicesPage implements OnInit {
  devices: any[] = [];
  currentDeviceUuid: string = '';
  isLoading = true;
  currentUserId: string | null = null;

  constructor(
    private api: ApiService,
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
    this.api.get(`devices.php?action=list&user_id=${userId}`).subscribe(
      (data: any) => {
        this.devices = data || [];
        this.isLoading = false;
      },
      (err) => {
        console.error(err);
        this.isLoading = false;
      }
    );
  }

  goBack() {
    this.nav.back();
  }

  async confirmRevoke(device: any) {
    const alert = await this.alertCtrl.create({
      header: 'Revoke Device?',
      message: `Are you sure you want to log out ${device.device_name}?`,
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

  async revokeDevice(device: any) {
    if (!this.currentUserId) return;

    // Revoke API call
    this.api.post('devices.php?action=revoke', {
      user_id: this.currentUserId,
      device_uuid: device.device_uuid
    }).subscribe(async () => {
      const toast = await this.toastCtrl.create({ message: 'Device revoked', duration: 2000 });
      toast.present();
      this.loadDevices(this.currentUserId!);
    }, async () => {
      const toast = await this.toastCtrl.create({ message: 'Failed to revoke device', duration: 2000 });
      toast.present();
    });
  }
}
