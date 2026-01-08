import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { ApiService } from 'src/app/services/api.service';
import { LoggingService } from 'src/app/services/logging.service';

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
    private logger: LoggingService
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

  triggerFile() {
    document.getElementById('avatarInput')?.click();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      // Auto upload or wait for save? Usually auto-upload for avatar preview
      // Let's upload immediately for preview
      await this.uploadAvatar(file);
    }
  }

  async uploadAvatar(file: File) {
    this.isLoading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res: any = await this.api.post('upload.php', formData).toPromise();
      if (res && res.url) {
        this.user.photo_url = res.url;
        // Auto-save the URL to profile?
        await this.saveProfile(false);
      }
    } catch (e) {
      this.logger.error("Upload failed", e);
    } finally {
      this.isLoading = false;
    }
  }

  async saveProfile(showToast = true) {
    try {
      await this.auth.updateProfile({
        first_name: this.user.first_name,
        last_name: this.user.last_name,
        short_note: this.user.short_note,
        photo_url: this.user.photo_url
      });
      if (showToast) {
        // Toast
        alert('Profile Saved!');
      }
    } catch (e) {
      this.logger.error("Save failed", e);
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

  openPrivacy() {
    // Navigate to privacy settings
  }

  logout() {
    this.auth.logout();
    this.nav.navigateRoot('/login');
  }
}

