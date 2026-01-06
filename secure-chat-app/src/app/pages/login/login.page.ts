import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  phoneNumber = '';
  otp = '';
  otpSent = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toast: ToastController,
    private zone: NgZone
  ) { }

  async sendOtp() {
    this.auth.requestOtp(this.phoneNumber).subscribe({
      next: (res: any) => {
        this.otpSent = true;
        this.showToast('OTP Sent! (Use 123456)');
      },
      error: (err) => {
        console.error(err);
        let msg = 'Error sending OTP';
        if (err.error && err.error.error) {
          msg = err.error.error; // PHP Error
        } else if (err.message) {
          msg = err.message; // JS/Network Error
        }
        this.showToast(msg);
      }
    });
  }

  async verifyOtp() {
    try {
      await this.auth.verifyOtp(this.phoneNumber, this.otp);
      this.showToast('Login Successful');
      this.zone.run(() => {
        this.router.navigate(['/profile']).then(nav => {
          console.log('Navigation result:', nav);
          if (!nav) this.showToast('Navigation Failed');
        });
      });
    } catch (e: any) {
      this.showToast(e.message || 'Invalid OTP or Error');
    }
  }

  async showToast(msg: string) {
    const toast = await this.toast.create({ message: msg, duration: 2000 });
    toast.present();
  }
}
