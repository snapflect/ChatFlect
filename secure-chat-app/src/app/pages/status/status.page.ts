import { Component, OnInit } from '@angular/core';
import { StatusService } from 'src/app/services/status.service';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
import { StatusViewerPage } from '../status-viewer/status-viewer.page';

@Component({
  selector: 'app-status',
  templateUrl: './status.page.html',
  styleUrls: ['./status.page.scss'],
  standalone: false
})
export class StatusPage implements OnInit {
  myStatus: any = null;
  recentUpdates: any[] = [];
  viewedUpdates: any[] = []; // Todo: Logic for viewed

  constructor(
    private statusService: StatusService,
    private modalCtrl: ModalController,
    private toast: ToastController,
    private alertCtrl: AlertController
  ) { }

  // ...

  async showViewers(event: Event, status: any) {
    event.stopPropagation(); // Don't open viewer

    const viewers: any = await this.statusService.getViewers(status.id).toPromise();

    if (!viewers || viewers.length === 0) {
      const t = await this.toast.create({ message: 'No views yet', duration: 1000 });
      t.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Viewed By',
      inputs: viewers.map((v: any) => ({
        type: 'radio',
        label: `${v.first_name} ${v.last_name} (${new Date(v.viewed_at).toLocaleTimeString()})`,
        value: v.viewer_id,
        disabled: true // Just for display
      })),
      buttons: ['Close']
    });
    await alert.present();
  }

  ngOnInit() {
    this.loadStatus();
  }

  loadStatus() {
    this.statusService.getFeed().subscribe((res: any) => {
      // Split me vs others
      const myId = localStorage.getItem('user_id');
      this.myStatus = res.find((u: any) => u.user_id === myId);
      this.recentUpdates = res.filter((u: any) => u.user_id !== myId);
    });
  }

  async uploadStatus(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Simple Upload w/o Caption for now
      this.statusService.uploadStatus(file, '').subscribe(async () => {
        const t = await this.toast.create({ message: 'Status Uploaded!', duration: 2000 });
        t.present();
        this.loadStatus();
      });
    }
  }

  async viewStatus(userStatus: any) {
    const modal = await this.modalCtrl.create({
      component: StatusViewerPage,
      componentProps: {
        userStatuses: userStatus.updates
      }
    });
    return await modal.present();
  }
}
