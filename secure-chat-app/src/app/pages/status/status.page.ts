import { Component, OnInit } from '@angular/core';
import { StatusService } from 'src/app/services/status.service';
import { ModalController, ToastController } from '@ionic/angular';
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
    private toast: ToastController
  ) { }

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
