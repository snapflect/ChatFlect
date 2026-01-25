import { Component, NgZone, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ToastController } from '@ionic/angular';
import { LoggingService } from 'src/app/services/logging.service';
import { LinkService } from 'src/app/services/link.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnDestroy {
  @ViewChild('qrCanvas') qrCanvas!: ElementRef;

  mode: 'phone' | 'qr' = 'phone';
  phoneNumber = '';
  email = ''; // Added
  otp = '';
  otpSent = false;
  qrLoading = false;

  // Resend OTP properties
  resendCooldown = 0;
  resendAttempts = 0;
  maxResendAttempts = 3;
  private cooldownInterval: any = null;

  private syncSub: any;

  constructor(
    private auth: AuthService,
    private linkService: LinkService,
    private router: Router,
    private toast: ToastController,
    private zone: NgZone,
    private logger: LoggingService
  ) { }

  ngOnDestroy() {
    if (this.syncSub) this.syncSub.unsubscribe();
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }

  segmentChanged(ev: any) {
    this.mode = ev.detail.value;
    if (this.mode === 'qr') {
      this.initQrLogin();
    } else {
      if (this.syncSub) this.syncSub.unsubscribe();
    }
  }

  async initQrLogin() {
    this.qrLoading = true;
    try {
      // 1. Generate Session
      const session = await this.linkService.generateLinkSession();

      // 2. Render QR
      // Payload: SessionID + PubKey
      const qrData = JSON.stringify({
        sid: session.sessionId,
        pk: session.publicKey
      });

      // Wait for view update
      setTimeout(() => {
        if (this.qrCanvas) {
          QRCode.toCanvas(this.qrCanvas.nativeElement, qrData, {
            width: 256,
            margin: 2,
            color: {
              dark: '#5260ff', // Primary
              light: '#ffffff'
            }
          }, (error: any) => {
            if (error) this.logger.error('QR Gen Error', error);
          });
        }
      }, 100);

      // 3. Listen
      this.syncSub = this.linkService.listenForSync(session.sessionId).subscribe(async (data) => {
        if (data && data.payload) {
          this.logger.log("Sync Payload Received!");
          await this.handleSync(data.payload, session.privateKey, session.sessionId);
        }
      });

    } catch (e) {
      this.logger.error("QR Init Failed", e);
      this.showToast("Failed to generate QR code");
    } finally {
      this.qrLoading = false;
    }
  }

  async handleSync(payloadEnc: string, privKey: string, sessionId: string) {
    try {
      await this.linkService.completeHandshake(payloadEnc, privKey);
      await this.linkService.cleanup(sessionId);
      this.showToast("Device Linked Successfully!");
      // Reload happens in service, but we can nav just in case
    } catch (e) {
      this.showToast("Linking Failed: Decryption Error");
    }
  }

  async sendOtp() {
    if (!this.phoneNumber || !this.email) {
      this.showToast("Please enter Phone Number and Email");
      return;
    }

    this.auth.requestOtp(this.phoneNumber, this.email).subscribe({
      next: (res: any) => {
        this.otpSent = true;
        this.showToast('OTP Sent to Email!');
        this.startCooldown();
      },
      error: (err) => {
        this.logger.error("Login Error", err);
        let msg = 'Error sending OTP';
        if (err && err.error && err.error.error) {
          msg = err.error.error;
        } else if (err && err.message) {
          msg = err.message;
        }
        this.showToast(msg);
      }
    });
  }

  async resendOtp() {
    if (this.resendCooldown > 0) {
      this.showToast(`Please wait ${this.resendCooldown} seconds`);
      return;
    }

    if (this.resendAttempts >= this.maxResendAttempts) {
      this.showToast('Maximum resend attempts reached. Please try again later.');
      return;
    }

    this.resendAttempts++;

    this.auth.requestOtp(this.phoneNumber, this.email).subscribe({
      next: (res: any) => {
        this.showToast(`OTP Resent! (Attempt ${this.resendAttempts}/${this.maxResendAttempts})`);
        this.startCooldown();
      },
      error: (err) => {
        this.logger.error("Resend OTP Error", err);
        let msg = 'Error resending OTP';
        if (err && err.error && err.error.error) {
          msg = err.error.error;
        } else if (err && err.status === 429) {
          msg = 'Too many requests. Please wait a few minutes.';
        }
        this.showToast(msg);
      }
    });
  }

  private startCooldown() {
    this.resendCooldown = 60;
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);

    this.cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownInterval);
        this.cooldownInterval = null;
      }
    }, 1000);
  }

  async verifyOtp() {
    try {
      const res: any = await this.auth.verifyOtp(this.phoneNumber, this.otp, this.email);
      this.showToast('Login Successful');

      this.zone.run(async () => { // Async for profile check
        let targetRoute = '/tabs';

        // Check if New User OR Profile Incomplete
        if (res.is_new_user) {
          targetRoute = '/profile';
        } else {
          // Robustness: Check if an "Existing" user actually has a profile
          // (Covering the case where they registered but didn't finish setup)
          const isComplete = await this.auth.isProfileComplete();
          if (!isComplete) {
            targetRoute = '/profile';
          }
        }

        this.router.navigate([targetRoute]).then(nav => {
          if (!nav) this.showToast('Navigation Failed');
        });
      });
    } catch (e: any) {
      const msg = (e && e.message) ? e.message : 'Invalid OTP or Error';
      this.showToast(msg);
    }
  }

  async showToast(msg: string) {
    const toast = await this.toast.create({ message: msg, duration: 2000 });
    toast.present();
  }

  // Google OAuth Sign-In
  async signInWithGoogle() {
    try {
      const res: any = await this.auth.signInWithGoogle();
      this.showToast('Google Sign-In Successful');

      this.zone.run(async () => {
        let targetRoute = '/tabs';

        // Check if New User OR Profile Incomplete
        if (res.is_new_user) {
          targetRoute = '/profile';
        } else {
          const isComplete = await this.auth.isProfileComplete();
          if (!isComplete) {
            targetRoute = '/profile';
          }
        }

        this.router.navigate([targetRoute]).then(nav => {
          if (!nav) this.showToast('Navigation Failed');
        });
      });
    } catch (e: any) {
      const msg = (e && e.message) ? e.message : 'Google Sign-In Failed';
      if (!msg.includes('cancelled') && !msg.includes('cancel')) {
        this.showToast(msg);
      }
    }
  }
}
