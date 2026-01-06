import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Component({
    selector: 'app-image-modal',
    templateUrl: './image-modal.page.html',
    styleUrls: ['./image-modal.page.scss'],
    standalone: false
})
export class ImageModalPage implements OnInit {
    @Input() imageUrl: string = '';

    constructor(
        private modalController: ModalController,
        private toastController: ToastController
    ) { }

    ngOnInit() { }

    close() {
        this.modalController.dismiss();
    }

    async saveImage() {
        try {
            // 1. Fetch the blob from the Blob URL
            const response = await fetch(this.imageUrl);
            const blob = await response.blob();

            // 2. Convert to Base64
            const base64Data = await this.convertBlobToBase64(blob) as string;

            // 3. Save to Filesystem (Documents directory is safest for cross-platform without extra permissions hell)
            const fileName = `secure_chat_${Date.now()}.jpg`;
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Documents
            });

            const toast = await this.toastController.create({
                message: `Image saved to Documents/${fileName}`,
                duration: 2000,
                color: 'success'
            });
            toast.present();

        } catch (e) {
            console.error('Save failed', e);
            const toast = await this.toastController.create({
                message: 'Failed to save image.',
                duration: 2000,
                color: 'danger'
            });
            toast.present();
        }
    }

    private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
}
