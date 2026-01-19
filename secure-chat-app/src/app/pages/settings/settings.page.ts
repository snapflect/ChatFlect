import { Component, OnInit } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { ApiService } from 'src/app/services/api.service';
import { LoggingService } from 'src/app/services/logging.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { LinkService } from 'src/app/services/link.service';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})


// ...

export class SettingsPage implements OnInit {
  user: any = {};
  selectedFile: File | null = null;
  isLoading = false;

  constructor(
    private auth: AuthService,
    private nav: NavController,
    private api: ApiService,
    private logger: LoggingService,
    private alertCtrl: AlertController,
    private crypto: CryptoService,
    private linkService: LinkService
  ) { }

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    const myId = localStorage.getItem('user_id');
    if (myId) {
      const res: any = await this.auth.getProfile(myId);
      if (res) this.user = res;
    }
  }

  openAccount() {
    this.nav.navigateForward('/profile'); // or account page
  }
  openChats() {
    // Navigate to chat settings
  }
  openNotifications() {
    // Navigate to notification settings 
  }

  async resetKeys() {
    // ... (existing)
  }

  // --- DEVICE LINKING ---
  async linkDevice() {
    this.isLoading = true;
    try {
      // 1. Install Module (needed for Capacitor MLKit)
      // On Web this throws/does nothing? We need to handle web carefully.
      // Ideally run only if Capacitor.isNativePlatform()

      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      // 2. Scan
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode]
      });

      if (barcodes.length > 0) {
        const raw = barcodes[0].rawValue;
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if (data.sid && data.pk) {
              await this.linkService.sendSyncData(data.sid, data.pk);
              window.alert(`Device Linked! Desktop should reload automatically.`);
            } else {
              window.alert("Invalid QR Code");
            }
          } catch (e) {
            window.alert("Invalid QR Format");
          }
        }
      }

    } catch (e: any) {
      if (e && e.message && e.message.includes('canceled')) {
        // User canceled
      } else {
        this.logger.error("Scan Failed", e);
        const msg = (e && e.message) ? e.message : 'Unknown Scan Error';
        window.alert("Scan Failed: " + msg);
      }
    } finally {
      this.isLoading = false;
    }
  }

  openPrivacy() {
    // ... 
  }

  async deleteAccount() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Account?',
      message: 'This action cannot be undone. All your data will be permanently deleted.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.auth.deleteAccount();
            this.nav.navigateRoot('/login');
          }
        }
      ]
    });
    await alert.present();
  }

  logout() {
    this.auth.logout();
    this.nav.navigateRoot('/login');
  }
}

