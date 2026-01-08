import { Component } from '@angular/core';
import { StatusService } from 'src/app/services/status.service';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-status-creator',
  templateUrl: './status-creator.page.html',
  styleUrls: ['./status-creator.page.scss'],
  standalone: false
})
export class StatusCreatorPage {
  type: 'text' | 'image' = 'text';

  // Text Mode Data
  textContent = '';
  backgroundColor = '#EF5350'; // Red default
  selectedFont = 'sans-serif';
  colors = ['#EF5350', '#AB47BC', '#5C6BC0', '#26A69A', '#66BB6A', '#FFA726', '#8D6E63', '#455A64'];
  fonts = ['sans-serif', 'serif', 'monospace', 'cursive'];

  // Image Mode Data
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  caption = '';

  // Common
  privacy = 'everyone';

  constructor(
    private statusService: StatusService,
    private router: Router,
    private toast: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  onTypeChange() {
    // Reset validations if needed
  }

  toggleFont() {
    const idx = this.fonts.indexOf(this.selectedFont);
    this.selectedFont = this.fonts[(idx + 1) % this.fonts.length];
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => this.previewUrl = e.target.result;
      reader.readAsDataURL(file);
    }
  }

  async postStatus() {
    const loading = await this.loadingCtrl.create({ message: 'Posting...' });
    await loading.present();

    try {
      if (this.type === 'text') {
        if (!this.textContent.trim()) return;
        await this.statusService.uploadTextStatus(
          this.textContent,
          this.backgroundColor,
          this.selectedFont,
          this.privacy
        ).toPromise();
      } else {
        if (!this.selectedFile) return;
        await this.statusService.uploadStatus(
          this.selectedFile,
          this.caption,
          this.privacy
        ).toPromise();
      }

      loading.dismiss();
      this.showToast('Status Posted!');
      this.router.navigate(['/status']); // Assuming there is a Status Feed page
    } catch (e) {
      loading.dismiss();
      this.showToast('Failed to post status');
    }
  }

  async showToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 2000 });
    t.present();
  }
}
