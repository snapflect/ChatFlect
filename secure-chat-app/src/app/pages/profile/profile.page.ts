import { Component, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ProfileService } from 'src/app/services/profile.service';
import { AuthService } from 'src/app/services/auth.service';
import { ToastController, NavController, ModalController } from '@ionic/angular';
import { LoggingService } from 'src/app/services/logging.service';
import { ImagePreviewModalPage } from '../image-preview-modal/image-preview-modal.page';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit {
  profile = {
    first_name: '',
    last_name: '',
    short_note: '',
    photo_url: '',
    phone_number: '',
    is_profile_complete: 0
  };

  isEditingPhone = false;
  showPhoneOtpInput = false;
  phoneOtp = '';
  tempEmail = ''; // To be fetched from profile or auth

  constructor(
    private profileService: ProfileService,
    private toast: ToastController,
    private nav: NavController,
    private logger: LoggingService,
    private modalCtrl: ModalController,
    private auth: AuthService // v13
  ) { }

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      this.logger.log("[ProfilePage] Loading initial profile...");
      const res: any = await this.profileService.getProfile();
      if (res) {
        this.profile = { ...this.profile, ...res };
        this.logger.log(`[ProfilePage] Initial photo_url: ${this.profile.photo_url}`);
      }

      // Important: Background sync might finish later. Re-check after 3s.
      setTimeout(async () => {
        const updatedRes: any = await this.profileService.getProfile();
        if (updatedRes && updatedRes.photo_url !== this.profile.photo_url) {
          this.logger.log(`[ProfilePage] Late sync detected new photo_url: ${updatedRes.photo_url}`);
          this.profile = { ...this.profile, ...updatedRes };
        }
      }, 3000);

    } catch (e) {
      this.logger.error("Profile Load Error", e);
    }
  }

  async saveProfile() {
    if (!this.profile.phone_number || !/^\+?[0-9]{10,15}$/.test(this.profile.phone_number)) {
      const t = await this.toast.create({ message: 'Valid Phone Number Required', duration: 1500 });
      t.present();
      return;
    }

    try {
      await this.profileService.updateProfile(this.profile);
      const t = await this.toast.create({ message: 'Profile Saved', duration: 1500 });
      t.present();

      // Update local storage
      localStorage.setItem('is_profile_complete', '1');
      if (this.profile.first_name) {
        localStorage.setItem('user_first_name', this.profile.first_name);
      }

      this.nav.navigateRoot('/tabs/chats');
    } catch (e: any) {
      let msg = 'Error Saving';
      if (e && e.error && e.error.error) msg = e.error.error;
      const errToast = await this.toast.create({ message: msg, duration: 1500 });
      errToast.present();
    }
  }

  startPhoneEdit() {
    this.isEditingPhone = true;
  }

  async requestPhoneUpdateOtp() {
    if (!this.profile.phone_number || !/^\+?[0-9]{10,15}$/.test(this.profile.phone_number)) {
      this.showToast("Enter valid new phone number");
      return;
    }

    try {
      // We need the user's email to send the OTP.
      // ProfileService.getProfile should ideally return email too now.
      // For now, assume it's available in some way or trigger a generic request.
      // The backend 'register.php' handles sending OTP to the logged in user's email if we update it.
      // Actually, let's use a simpler approach: use AuthService.requestOtp but for the EXISTING email.
      // But wait, the user said "otp is only through email always... even for changing phone number".

      // I'll fetch the email from the profile res if I update the backend.
      const fullProfile: any = await this.profileService.getProfile();
      if (fullProfile && fullProfile.email) {
        await this.profileService.requestPhoneUpdateOtp(fullProfile.email, this.profile.phone_number);
        this.showPhoneOtpInput = true;
        this.showToast("OTP sent to your registered email");
      } else {
        this.showToast("Email not found for verification");
      }
    } catch (e: any) {
      if (e.status === 409) {
        this.showToast("This phone number is already linked to another account");
      } else {
        this.showToast(e.error?.error || "Failed to send OTP");
      }
    }
  }

  async verifyPhoneUpdate() {
    try {
      const fullProfile: any = await this.profileService.getProfile();
      await this.profileService.verifyPhoneUpdate(fullProfile.email, this.phoneOtp);

      this.isEditingPhone = false;
      this.showPhoneOtpInput = false;
      this.profile.is_profile_complete = 1;
      this.showToast("Phone Number Verified!");
      // Refresh profile to get the latest DB state
      await this.loadProfile();
    } catch (e: any) {
      this.showToast(e.error?.error || "Invalid OTP");
    }
  }

  async rotateEncryptionKeys() {
    try {
      await this.auth.rotateKeys();
      this.showToast("Keys Rotated Successfully!");
    } catch (e) {
      this.logger.error("Key Rotation Failed", e);
      this.showToast("Failed to rotate keys.");
    }
  }

  private async showToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 1500 });
    t.present();
  }


  async changePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80, // Increased quality slightly
        allowEditing: true, // User request: "allow crop and resize"
        resultType: CameraResultType.Base64, // Still use Base64 for handling
        source: CameraSource.Prompt
      });

      if (image.base64String) {
        // Convert to Blob
        const blob = this.b64toBlob(image.base64String, 'image/' + image.format);
        const formData = new FormData();
        formData.append('file', blob, `profile_${new Date().getTime()}.${image.format}`);

        // Upload
        // We need a direct upload call here since ProfileService.updateProfile doesn't handle files
        // We'll use fetch/api service for this specific upload
        // Assuming ApiService has a method or we can use it directly? 
        // We'll inject ApiService to be clean.
        this.uploadImage(formData);
      }
    } catch (e) {
      this.logger.error('Camera Error', e);
    }
  }

  async uploadImage(formData: FormData) {
    // We need to access ApiService. Let's add it to constructor first (next step).
    // Ideally, we move this to profileService, but for speed:
    // Fetch is easiest for FormData if ApiService wraps HttpClient which requires special handling for FormData
    // Let's assume we can use fetch for now to valid endpoint

    // Quick Fetch Hack to avoid circular dep or complex service rewrite
    try {
      // Import environment? We need the URL.
      // Let's use a relative path assuming proxy? No, mobile.
      // We need the full URL.
      // Let's just create a helper in ProfileService? Yes.
      const url = await this.profileService.uploadPhoto(formData);
      if (url) {
        // upload.php now returns absolute URL - use directly
        this.profile.photo_url = url;
        await this.toast.create({ message: 'Photo Uploaded!', duration: 1500 }).then(t => t.present());
      }
    } catch (e) {
      this.logger.error("Upload Error", e);
      await this.toast.create({ message: 'Upload Failed', duration: 1500 }).then(t => t.present());
    }
  }

  onImageError(event: any) {
    this.logger.error("[ProfilePage] Image failed to load!", {
      src: event.target.src,
      photo_url: this.profile.photo_url
    });
    event.target.src = 'assets/placeholder_user.png';
  }

  async viewPhoto() {
    if (this.profile.photo_url) {
      const modal = await this.modalCtrl.create({
        component: ImagePreviewModalPage,
        componentProps: {
          imageUrl: this.profile.photo_url
        }
      });
      return await modal.present();
    }
  }

  b64toBlob(b64Data: string, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  }
}
