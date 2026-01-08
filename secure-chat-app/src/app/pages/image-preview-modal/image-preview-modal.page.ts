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
  @Input() imageFile: any; // File or Blob
  previewUrl: any;
  caption: string = '';

  constructor(
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    if (this.imageFile) {
      const url = URL.createObjectURL(this.imageFile);
      this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  send() {
    this.modalCtrl.dismiss({
      caption: this.caption,
      file: this.imageFile
    }, 'send');
  }
}
