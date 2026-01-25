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

  constructor(
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    if (this.file) {
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
