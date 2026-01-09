import { Component, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ProfileService } from 'src/app/services/profile.service';
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
    photo_url: ''
  };

  constructor(
    private profileService: ProfileService,
    private toast: ToastController,
    private nav: NavController,
    private logger: LoggingService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      const res: any = await this.profileService.getProfile();
      if (res) {
        this.profile = { ...this.profile, ...res };
      }
    } catch (e) {
      this.logger.error("Profile Load Error", e);
    }
  }

  async saveProfile() {
    try {
      await this.profileService.updateProfile(this.profile);
      const t = await this.toast.create({ message: 'Profile Saved', duration: 1500 });
      t.present();
      this.nav.navigateRoot('/tabs/chats');
    } catch (e) {
      const errToast = await this.toast.create({ message: 'Error Saving', duration: 1500 });
      errToast.present();
    }
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
        // Append Base URL if needed, or if upload.php returns relative
        // db.php/upload.php returns "uploads/filename".
        // We need full URL for the app to display it? 
        // Ideally we store relative, and prepend in UI. 
        // But current UI uses [src]="c.photo_url".
        // Let's verify what `upload.php` returns. It returns "uploads/..."
        // We need to prepend the API base.
        this.profile.photo_url = 'https://chat.snapflect.com/' + url;
        await this.toast.create({ message: 'Photo Uploaded!', duration: 1500 }).then(t => t.present());
      }
    } catch (e) {
      this.logger.error("Upload Error", e);
      await this.toast.create({ message: 'Upload Failed', duration: 1500 }).then(t => t.present());
    }
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
