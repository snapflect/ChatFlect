import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-security-history',
  templateUrl: './security-history.page.html',
  styleUrls: ['./security-history.page.scss'],
  standalone: false
})
export class SecurityHistoryPage implements OnInit {
  events: any[] = [];
  isLoading = true;

  constructor(
    private api: ApiService,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading security history...',
      duration: 5000
    });
    await loading.present();

    this.api.get('security/history.php').subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.events = res.results;
        }
        this.isLoading = false;
        loading.dismiss();
      },
      error: (err) => {
        console.error('Failed to load history', err);
        this.isLoading = false;
        loading.dismiss();
      }
    });
  }

  getSeverityColor(severity: string) {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'WARN': return 'warning';
      default: return 'primary';
    }
  }

  formatEvent(event: string) {
    return event.replace(/_/g, ' ').toUpperCase();
  }

  doRefresh(event: any) {
    this.loadHistory().then(() => {
      event.target.complete();
    });
  }
}
