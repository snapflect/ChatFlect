import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { AuthService } from './auth.service';
import { Injector } from '@angular/core';

/**
 * MessageAckService (v2.3 Reliability Engine)
 * Manages the "Ticks" system: sent -> delivered -> read.
 * Pulls receipts from server and updates local_messages + local_receipts.
 */
@Injectable({
    providedIn: 'root'
})
export class MessageAckService {
    private isPolling = false;
    private readonly BASE_POLL_INTERVAL = 45000; // 45s
    private readonly MAX_POLL_INTERVAL = 600000; // 10m
    private currentPollInterval = 45000;
    private idleCounter = 0;
    private pollGeneration = 0; // Incremented on each start() — old loops self-terminate
    private startedAt = 0; // Timestamp of last start() for boot suppression
    private _authService: AuthService | null = null;
    private get authService(): AuthService {
        if (!this._authService) {
            this._authService = this.injector.get(AuthService);
        }
        return this._authService;
    }

    constructor(
        private localDb: LocalDbService,
        private logger: LoggingService,
        private http: HttpClient,
        private injector: Injector
    ) {
        this.initLifecycle();
    }

    private initLifecycle() {
        App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                this.logger.log('[MessageAck] App foregrounded. Resetting poll speed.');
                this.resetPollSpeed();
            } else {
                this.logger.log('[MessageAck] App backgrounded. Flushing receipts...');
                this.flush();
            }
        });
    }

    start() {
        // Terminate any existing poll loop by incrementing generation
        this.pollGeneration++;
        this.isPolling = true;
        this.startedAt = Date.now();
        this.resetPollSpeed();

        // Gate on Session Readiness (Firebase + Backend Cookie confirmed by ping)
        this.authService.sessionReady$.pipe(
            filter(Boolean),
            take(1)
        ).subscribe(() => {
            this.poll(this.pollGeneration);
        });
    }

    private async poll(generation: number) {
        // Self-terminate if this is a stale generation
        if (generation !== this.pollGeneration || !this.isPolling) return;

        // Gate on backend session readiness (Firebase signIn + cookie confirmed)
        try {
            await this.localDb.readyPromise;
            await firstValueFrom(
                this.authService.sessionReady$.pipe(filter(Boolean), take(1))
            );
        } catch {
            // sessionReady$ not available yet — retry after interval
            if (generation === this.pollGeneration) {
                setTimeout(() => this.poll(generation), this.currentPollInterval);
            }
            return;
        }

        try {
            const hasWork = await this.syncReceipts();

            if (hasWork) {
                this.idleCounter = 0;
            } else {
                this.idleCounter++;
            }

            // Adaptive interval: increase by 1.5x each idle cycle
            this.currentPollInterval = Math.min(
                this.BASE_POLL_INTERVAL * Math.pow(1.5, Math.min(this.idleCounter, 6)),
                this.MAX_POLL_INTERVAL
            );

        } catch (err: any) {
            this.logger.error('[MessageAck] Receipt Sync Error', err);
            if (err.message === 'VAULT_LOCKED') {
                this.logger.warn('[MessageAck] Vault locked during poll. Suspending...');
                this.localDb.lockVault();
            }
        }

        setTimeout(() => this.poll(generation), this.currentPollInterval);
    }

    /**
     * Reset the poll interval to base speed
     */
    resetPollSpeed() {
        this.idleCounter = 0;
        this.currentPollInterval = this.BASE_POLL_INTERVAL;
    }

    /**
     * Pull new receipts from the server
     * @returns boolean true if receipts were found
     */
    async syncReceipts(): Promise<boolean> {
        if (!navigator.onLine) return false;
        const net = await Network.getStatus();
        if (!net.connected) return false;

        await this.localDb.readyPromise;
        // Gate on session readiness — no HTTP calls until cookie is confirmed
        try {
            await firstValueFrom(
                this.authService.sessionReady$.pipe(filter(Boolean), take(1))
            );
        } catch {
            return false;
        }

        try {
            const response: any = await this.http.get(`${environment.apiUrl}/v4/messages/pull.php`, { withCredentials: true }).toPromise();

            if (response && response.success === true && Array.isArray(response.messages)) {
                if (response.messages.length === 0) return false;

                for (const msg of response.messages) {
                    // HF-8.26: Receipts are integrated into messages in v4
                    const payload = JSON.parse(msg.encrypted_payload);
                    if (payload.type === 'receipt') {
                        await this.processReceipt(payload);
                    }
                }
                return true;
            }
            return false;
        } catch (err: any) {
            // Suppress 401s during first 10s after start (boot transient)
            const isBootWindow = (Date.now() - this.startedAt) < 10000;
            if (err.status === 401 && isBootWindow) {
                this.logger.log('[MessageAck] Auth not ready yet (boot window), will retry');
            } else if (err.status === 404 || err.status === 204 || err.status === 0) {
                this.logger.log('[MessageAck] No receipts pending or poll deferred');
            } else {
                this.logger.warn('[MessageAck] Failed to pull receipts', err);
            }
            return false;
        }
    }

    /**
     * HF-2.3A: Background Flush Mode
     */
    async flush(): Promise<void> {
        // Simple flush: trigger sync once.
        await this.syncReceipts();
    }

    private async processReceipt(receipt: any): Promise<void> {
        // receipt: { message_uuid, user_id, status, timestamp }

        // 1. Log receipt in local_receipts table
        await this.localDb.run(`
            INSERT OR IGNORE INTO local_receipts (message_id, user_id, status, timestamp)
            VALUES (?, ?, ?, ?)
        `, [receipt.message_uuid, receipt.user_id, receipt.status, receipt.timestamp]);

        // 2. Update status in local_messages if this receipt is "higher" than current
        // Order: read > delivered > sent > pending
        const statusPriority: any = { 'pending': 0, 'sent': 1, 'delivered': 2, 'read': 3 };

        const msg = await this.localDb.query('SELECT status FROM local_messages WHERE id = ?', [receipt.message_uuid]);
        if (msg.length > 0) {
            const currentStatus = msg[0].status;
            if (statusPriority[receipt.status] > statusPriority[currentStatus]) {
                await this.localDb.run('UPDATE local_messages SET status = ? WHERE id = ?', [receipt.status, receipt.message_uuid]);
                this.logger.log(`[MessageAck] Message ${receipt.message_uuid} status updated to ${receipt.status}`);
            }
        }
    }

    /**
     * Mark a received message as 'read' locally and notify server
     */
    async markAsRead(messageId: string): Promise<void> {
        await this.localDb.run("UPDATE local_messages SET status = 'read' WHERE id = ?", [messageId]);

        // HF-Extra: Standardized ACK Sync
        const pkg = {
            acks: [{
                message_uuid: messageId,
                status: 'read'
            }]
        };

        this.http.post(`${environment.apiUrl}/v4/messages/ack.php`, pkg, { withCredentials: true }).toPromise().catch(err => {
            this.logger.warn('[MessageAck] Read Receipt Failed', err);
        });
    }
}
