import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SecurityAlertsService, SecurityAlert } from '../../services/security-alerts.service';

@Component({
    selector: 'app-security-alerts',
    templateUrl: './security-alerts.page.html',
    styleUrls: ['./security-alerts.page.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class SecurityAlertsPage implements OnInit {
    private alertsService = inject(SecurityAlertsService);

    alerts: SecurityAlert[] = [];
    loading = false;
    filter: 'all' | 'unread' = 'all';

    ngOnInit() {
        this.loadAlerts();
    }

    async loadAlerts() {
        this.loading = true;
        this.alerts = await this.alertsService.getAlerts(50, this.filter === 'unread');
        this.loading = false;
    }

    async onFilterChange(filter: 'all' | 'unread') {
        this.filter = filter;
        await this.loadAlerts();
    }

    async markAsRead(alert: SecurityAlert) {
        if (alert.is_read) return;
        await this.alertsService.markRead(alert.id);
        alert.is_read = 1;
    }

    getAlertInfo(type: string) {
        return this.alertsService.getAlertInfo(type);
    }

    getSeverityColor(severity: string): string {
        switch (severity) {
            case 'CRITICAL': return 'danger';
            case 'WARNING': return 'warning';
            default: return 'success';
        }
    }
}
