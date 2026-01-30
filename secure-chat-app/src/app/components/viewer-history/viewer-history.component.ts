import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LocationService } from '../../services/location.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-viewer-history',
    template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Viewer History</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item *ngFor="let view of history$ | async">
          <ion-label>
            <h2>User ID: {{ view.viewerId }}</h2>
            <p>Viewed at: {{ view.timestamp | date:'medium' }}</p>
          </ion-label>
        </ion-item>
        <ion-item *ngIf="(history$ | async)?.length === 0">
          <ion-label class="ion-text-center">No views recorded yet.</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
    standalone: false
})
export class ViewerHistoryComponent implements OnInit {
    @Input() chatId!: string;
    history$!: Observable<any[]>;

    constructor(
        private modalCtrl: ModalController,
        private locationService: LocationService
    ) { }

    ngOnInit() {
        if (this.chatId) {
            this.history$ = this.locationService.getViewerHistory(this.chatId);
        }
    }

    close() {
        this.modalCtrl.dismiss();
    }
}
