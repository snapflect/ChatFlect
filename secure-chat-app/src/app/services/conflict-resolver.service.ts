import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
    providedIn: 'root'
})
export class ConflictResolverService {

    constructor(
        private toastCtrl: ToastController,
        private alertCtrl: AlertController
    ) { }

    /**
     * Handle 409 Conflict during sync.
     * Simple V14 Strategy: User Choice.
     */
    async resolve(actionId: string, error: any): Promise<'retry' | 'discard' | 'keep_remote'> {
        console.log('[ConflictResolver] Handling conflict for', actionId);

        return new Promise(async (resolve) => {
            const alert = await this.alertCtrl.create({
                header: 'Sync Conflict',
                message: 'This item was modified remotely while you were offline. How do you want to proceed?',
                backdropDismiss: false,
                buttons: [
                    {
                        text: 'Keep Remote',
                        handler: () => {
                            resolve('keep_remote');
                        }
                    },
                    {
                        text: 'Overwrite (My Version)',
                        cssClass: 'danger-action',
                        handler: () => {
                            resolve('retry'); // Retry implies force overwrite logic if API supports it, or just re-send
                        }
                    }
                ]
            });
            await alert.present();
        });
    }
}
