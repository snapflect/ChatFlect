import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-image-preview-modal',
  templateUrl: './image-preview-modal.page.html',
  styleUrls: ['./image-preview-modal.page.scss'],
  standalone: false
})
export class ImagePreviewModalPage implements OnInit {
  @Input() file: any; // File or Blob (Renamed from imageFile to match caller)
  @Input() viewOnceAvailable: boolean = false;

  previewUrl: any;
  caption: string = '';
  isViewOnce: boolean = false;
  isVideo: boolean = false;
  isImage: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    if (this.file) {
      this.isVideo = this.file.type?.startsWith('video/');
      this.isImage = this.file.type?.startsWith('image/') || !this.file.type; // Fallback to image

      const url = URL.createObjectURL(this.file);
      this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    }
  }

  toggleViewOnce() {
    this.isViewOnce = !this.isViewOnce;
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  send() {
    this.modalCtrl.dismiss({
      confirmed: true,
      caption: this.caption,
      viewOnce: this.isViewOnce
    }, 'send');
  }
}
