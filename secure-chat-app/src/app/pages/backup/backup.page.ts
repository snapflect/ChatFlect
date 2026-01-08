import { Component, OnInit } from '@angular/core';
import { BackupService } from '../../services/backup.service';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

@Component({
    selector: 'app-backup',
    templateUrl: './backup.page.html',
    styleUrls: ['./backup.page.scss'],
    standalone: false
})
export class BackupPage implements OnInit {

    constructor(
        private backupService: BackupService,
        private toastCtrl: ToastController,
        private alertCtrl: AlertController,
        private loadingCtrl: LoadingController
    ) { }

    ngOnInit() {
    }

    async createBackup() {
        const loading = await this.loadingCtrl.create({ message: 'Generating Backup...' });
        await loading.present();

        try {
            const blob = await this.backupService.createBackup();
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                // Save to Filesystem (Downloads folder?) or Share
                // For Web/Simplicity: Trigger download anchor
                this.downloadBlob(blob, `snapflect_backup_${new Date().getTime()}.json`);

                loading.dismiss();
                this.showToast('Backup Created & Downloaded!');
            };
            reader.readAsDataURL(blob);

        } catch (e) {
            loading.dismiss();
            this.showToast('Backup Failed');
        }
    }

    downloadBlob(blob: Blob, filename: string) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    async restoreBackup() {
        // Trigger File Input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => this.processRestore(e);
        input.click();
    }

    async processRestore(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        const loading = await this.loadingCtrl.create({ message: 'Restoring...' });
        await loading.present();

        const reader = new FileReader();
        reader.onload = async (e: any) => {
            const json = e.target.result;
            const success = await this.backupService.restoreBackup(json);
            loading.dismiss();

            if (success) {
                const alert = await this.alertCtrl.create({
                    header: 'Restore Successful',
                    message: 'Your keys have been restored. Please restart the app or re-login.',
                    buttons: ['OK']
                });
                await alert.present();
            } else {
                this.showToast('Invalid Backup File');
            }
        };
        reader.readAsText(file);
    }

    async showToast(msg: string) {
        const t = await this.toastCtrl.create({ message: msg, duration: 2000 });
        t.present();
    }
}
