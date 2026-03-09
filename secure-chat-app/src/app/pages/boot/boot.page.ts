import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppInitService, BootStage } from '../../services/app-init.service';
import { filter, take } from 'rxjs/operators';

@Component({
    selector: 'app-boot',
    template: `
        <ion-content class="boot-screen">
            <div class="boot-container">
                <ion-spinner *ngIf="bootStage !== 'BOOT_FAILED'" name="crescent" color="primary"></ion-spinner>
                <p *ngIf="bootStage !== 'BOOT_FAILED'">Starting securely...</p>
                <div *ngIf="bootStage === 'BOOT_FAILED'" class="boot-error">
                    <p>Boot failed. Please try again.</p>
                    <ion-button (click)="retry()" expand="block" color="danger">Retry</ion-button>
                </div>
            </div>
        </ion-content>
    `,
    styles: [`
        .boot-screen {
            --background: #000;
        }
        .boot-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #fff;
        }
        .boot-container p {
            margin-top: 16px;
            font-size: 14px;
            opacity: 0.7;
        }
        .boot-error {
            text-align: center;
            padding: 20px;
        }
    `],
    standalone: false
})
export class BootPage implements OnInit {
    bootStage = '';

    constructor(
        private appInit: AppInitService,
        private router: Router
    ) { }

    ngOnInit() {
        // Track boot stage for UI
        this.appInit.bootState$.subscribe(stage => {
            this.bootStage = stage;
        });

        // Wait for boot to complete, then navigate based on stored auth state
        this.appInit.initialized$.pipe(
            filter(Boolean),
            take(1)
        ).subscribe(() => {
            const userId = localStorage.getItem('user_id');
            const profileComplete = localStorage.getItem('is_profile_complete') === '1';

            if (userId && profileComplete) {
                this.router.navigateByUrl('/tabs/chats', { replaceUrl: true });
            } else if (userId) {
                this.router.navigateByUrl('/profile', { replaceUrl: true });
            } else {
                this.router.navigateByUrl('/login', { replaceUrl: true });
            }
        });

        // Handle safe mode (biometric failed)
        this.appInit.bootState$.pipe(
            filter(s => s === BootStage.SAFE_MODE),
            take(1)
        ).subscribe(() => {
            this.router.navigateByUrl('/login', { replaceUrl: true });
        });
    }

    retry() {
        this.appInit.retry();
    }
}
