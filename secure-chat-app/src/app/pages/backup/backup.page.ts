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
        const alert = await this.alertCtrl.create({
            header: 'Encrypt Backup',
            message: 'Please enter a password to encrypt your backup file.',
            inputs: [
                {
                    name: 'password',
                    type: 'password',
                    placeholder: 'Password (min 8 chars)'
                }
            ],
            buttons: [
                {
                    text: 'Cancel',
                    role: 'cancel'
                },
                {
                    text: 'Create',
                    handler: (data) => {
                        this.doCreateBackup(data.password);
                    }
                }
            ]
        });
        await alert.present();
    }

    async doCreateBackup(password: string) {
        if (!password || password.length < 8) {
            this.showToast('Password must be at least 8 characters');
            return;
        }

        const loading = await this.loadingCtrl.create({ message: 'Generating Encrypted Backup...' });
        await loading.present();

        try {
            const blob = await this.backupService.createBackup(password);

            // Trigger download
            this.downloadBlob(blob, `snapflect_secure_backup_${new Date().getTime()}.bin`); // .bin for binary

            loading.dismiss();
            this.showToast('Backup Created & Downloaded!');

        } catch (e: any) {
            loading.dismiss();
            const msg = e.message || 'Backup Failed';
            this.showToast(msg);
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
        input.accept = '.bin,.json'; // Accept both for now
        input.onchange = (e: any) => this.processRestore(e);
        input.click();
    }

    async processRestore(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        const alert = await this.alertCtrl.create({
            header: 'Decrypt Backup',
            message: 'Enter the password to decrypt this backup.',
            inputs: [
                {
                    name: 'password',
                    type: 'password',
                    placeholder: 'Password'
                }
            ],
            buttons: [
                {
                    text: 'Cancel',
                    role: 'cancel'
                },
                {
                    text: 'Restore',
                    handler: (data) => {
                        this.doRestoreBackup(file, data.password);
                    }
                }
            ]
        });
        await alert.present();
    }

    async doRestoreBackup(file: File, password: string) {
        const loading = await this.loadingCtrl.create({ message: 'Restoring...' });
        await loading.present();

        try {
            const success = await this.backupService.restoreBackup(file, password);
            loading.dismiss();

            if (success) {
                const alert = await this.alertCtrl.create({
                    header: 'Restore Successful',
                    message: 'Your keys have been restored. The app will now reload.',
                    buttons: [
                        {
                            text: 'OK',
                            handler: () => {
                                window.location.reload();
                            }
                        }
                    ]
                });
                await alert.present();
            } else {
                this.showToast('Restore returned false');
            }
        } catch (e: any) {
            loading.dismiss();
            const msg = e.message || 'Restore Failed';
            this.showToast(msg);
        }
    }

    async showToast(msg: string) {
        const t = await this.toastCtrl.create({ message: msg, duration: 2000 });
        t.present();
    }
}
