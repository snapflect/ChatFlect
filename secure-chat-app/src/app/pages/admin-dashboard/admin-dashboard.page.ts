import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: false
})
export class AdminDashboardPage implements OnInit {
  stats: any = null;
  logs: any[] = [];
  isLoading = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    try {
      // 1. Get Stats
      this.stats = await this.api.get('admin.php?action=stats').toPromise();

      // 2. Get Logs
      const logsRes: any = await this.api.get('admin.php?action=audit-logs').toPromise();
      this.logs = logsRes?.data || [];
    } catch (e: any) {
      console.error('Admin Load Failed', e);
      // If 403, likely not admin
      if (e?.status === 403) {
        const toast = await this.toastCtrl.create({
          message: 'Access Denied: Admin privileges required.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
      }
    } finally {
      this.isLoading = false;
    }
  }

  doRefresh(event: any) {
    this.loadData().then(() => event.target.complete());
  }

  getLogColor(action: string): string {
    if (action.includes('failed') || action.includes('evicted') || action.includes('revoked')) return 'danger';
    if (action.includes('block')) return 'warning';
    return 'medium';
  }
}
