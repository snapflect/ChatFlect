import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { ApiService } from './api.service';
import { CryptoService } from './crypto.service';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError, shareReplay, finalize } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
import { LoggingService } from './logging.service';
import { TransferProgressService } from './transfer-progress.service';
import { Capacitor } from '@capacitor/core';
import { StorageService } from './storage.service';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Injectable({ providedIn: 'root' })
export class SecureMediaService implements OnDestroy {

    private cache = new Map<string, { url: string, timestamp: number, buffer?: Uint8Array }>();
    private objectUrls = new Set<string>();
    private inProgress = new Map<string, Observable<string>>();
    private expiryCheckInterval: any;

    // --- INTEGRITY & THROTTLING (v8 Definitive) ---
    private suppressedLogs = new Map<string, number>();
    private usageCounts = new Map<string, number>(); // URL -> number of components using it
    private activeIntegrityChecks = 0;
    private integrityQueue: Array<{ url: string, etag: string, resolve: any }> = [];
    private MAX_CONCURRENT_CHECKS = 3;

    constructor(
        private api: ApiService,
        private crypto: CryptoService,
        private logger: LoggingService,
        private storage: StorageService,
        private zone: NgZone,
        private progressService: TransferProgressService
    ) {
        this.initService();
    }

    private initService() {
        // Prune and Reconcile SQLite cache on init (v8)
        this.storage.pruneMediaCache(7).catch(() => { });
        setTimeout(() => this.storage.reconcileCache().catch(() => { }), 5000);

        // Periodically check for expired keys
        this.expiryCheckInterval = setInterval(() => this.checkExpirations(), 5 * 60 * 1000);

        // v15: Cleanup old partial downloads
        this.cleanupPartialDownloads();
    }

    private async cleanupPartialDownloads() {
        try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const res = await Filesystem.readdir({ path: '', directory: Directory.Cache });
            const now = Date.now();

            for (const file of res.files) {
                if (file.name.endsWith('.part')) {
                    // Stat to check age
                    // Note: Readdir might provide stat in some versions, but let's be safe
                    const stat = await Filesystem.stat({ path: file.name, directory: Directory.Cache });
                    const mtime = stat.mtime; // ms
                    if (now - mtime > 24 * 60 * 60 * 1000) {
                        await Filesystem.deleteFile({ path: file.name, directory: Directory.Cache });
                        console.log(`[SecureMedia][v15] Cleaned up orphan: ${file.name}`);
                    }
                }
            }
        } catch (e) {
            console.warn('[SecureMedia] Cleanup warning', e);
        }
    }

    // Helper for deterministic part filenames
    private getPartPath(url: string): string {
        // Simple hash or b64 to make it filesystem safe
        // Using btoa might result in "/" which breaks paths. Replace chars.
        const safe = btoa(url).replace(/\//g, '_').replace(/\+/g, '-').substring(0, 64);
        return `partial_${safe}.part`;
    }

    ngOnDestroy(): void {
        if (this.expiryCheckInterval) clearInterval(this.expiryCheckInterval);
        this.clearCache('destroy');
    }

    getMedia(url: string, key?: string, iv?: string, mimeType: string = ''): Observable<string> {
        if (!url || typeof url !== 'string') return of('assets/placeholder_broken.png');

        const userId = localStorage.getItem('user_id') || 'anon';
        const cacheKey = `${userId}::${url}::${key || ''}::${iv || ''}`;

        if (this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey)!;
            entry.timestamp = Date.now();
            return of(entry.url);
        }

        if (url.startsWith('assets/') || url.startsWith('data:') || url.startsWith('blob:')) {
            return of(url);
        }

        if (this.inProgress.has(cacheKey)) {
            return this.inProgress.get(cacheKey)!;
        }

        const isExternal = url.includes('googleusercontent.com') || url.startsWith('http');

        const obs = new Observable<string>(observer => {
            this.storage.getMediaCache(url).then(async entry => {
                if (entry && entry.blob_path) {
                    try {
                        const currentCount = this.usageCounts.get(url) || 0;
                        this.usageCounts.set(url, currentCount + 1);

                        const nativeUrl = Capacitor.isNativePlatform() && !entry.blob_path.startsWith('data:')
                            ? Capacitor.convertFileSrc(entry.blob_path)
                            : null;

                        if (nativeUrl) {
                            this.cache.set(cacheKey, { url: nativeUrl, timestamp: Date.now() });
                            this.throttledVerify(url, entry.etag, true).then(res => {
                                if (res.status === 'mismatch') this.handleIntegrityMismatch(url);
                                else if (res.status === 'match') {
                                    this.storage.deleteMediaRetry(url);
                                    this.storage.updateVerificationStatus(url, 'verified');
                                }
                            });
                            this.zoneRun(() => { observer.next(nativeUrl); observer.complete(); });
                            return;
                        }

                        // Web / Fallback
                        const file = await Filesystem.readFile({
                            path: entry.blob_path,
                            directory: Directory.Cache
                        });

                        const byteArray = Uint8Array.from(atob(file.data as string), c => c.charCodeAt(0));
                        let blob = new Blob([byteArray], { type: entry.mime });

                        if (key && iv) {
                            blob = await this.decryptMedia(blob, key, iv);
                        }

                        const objectUrl = URL.createObjectURL(blob);
                        this.objectUrls.add(objectUrl);
                        this.cache.set(cacheKey, { url: objectUrl, timestamp: Date.now() });
                        this.zoneRun(() => { observer.next(objectUrl); observer.complete(); });
                        return;
                    } catch (e) {
                        this.logger.error("[SecureMedia] Cache read fail", e);
                    }
                }

                if (isExternal && !key) {
                    this.cache.set(cacheKey, { url, timestamp: Date.now() });
                    this.zoneRun(() => { observer.next(url); observer.complete(); });
                    return;
                }

                // v15: Resumable Download
                const partPath = this.getPartPath(url);
                let startByte = 0;

                try {
                    const stat = await Filesystem.stat({ path: partPath, directory: Directory.Cache });
                    startByte = stat.size;
                } catch (e) { } // No part file

                const headers = startByte > 0 ? { 'Range': `bytes=${startByte}-` } : {};
                if (startByte > 0) this.logger.log(`[SecureMedia][v15] Resuming ${url} from ${startByte}`);

                this.api.getBlob(url, true, headers).subscribe({
                    next: async (event: any) => {
                        if (event.type === HttpEventType.DownloadProgress) {
                            const total = event.total ? event.total + startByte : 0;
                            const loaded = event.loaded + startByte;
                            const percent = total > 0 ? Math.round(100 * loaded / total) : 0;
                            this.progressService.updateProgress(url, percent, 'downloading');
                        } else if (event.type === HttpEventType.Response) {
                            try {
                                const chunkBlob = event.body;
                                if (!chunkBlob) throw new Error('Empty blob');

                                // Append to disk
                                await this.appendPart(partPath, chunkBlob, event.status === 206);

                                // Finalize
                                const finalFilename = `media_${Date.now()}_${Math.floor(Math.random() * 1000)}.bin`;
                                await Filesystem.rename({ from: partPath, to: finalFilename, directory: Directory.Cache });
                                await this.storage.saveMediaCache(url, finalFilename, chunkBlob.type); // chunk type might be wrong if partial? Usually OK.

                                // Read FULL file for Decrypt
                                const fullFile = await Filesystem.readFile({ path: finalFilename, directory: Directory.Cache });
                                const byteArray = Uint8Array.from(atob(fullFile.data as string), c => c.charCodeAt(0));
                                let finalBlob = new Blob([byteArray], { type: chunkBlob.type });

                                if (key && iv) {
                                    finalBlob = await this.decryptMedia(finalBlob, key, iv);
                                }

                                if (mimeType) {
                                    finalBlob = new Blob([finalBlob], { type: mimeType });
                                }

                                const objectUrl = URL.createObjectURL(finalBlob);
                                this.objectUrls.add(objectUrl);
                                this.usageCounts.set(url, 1);
                                this.cache.set(cacheKey, { url: objectUrl, timestamp: Date.now() });

                                this.progressService.updateProgress(url, 100, 'completed');
                                setTimeout(() => this.progressService.clearProgress(url), 2000);
                                this.zoneRun(() => { observer.next(objectUrl); observer.complete(); });
                            } catch (err) {
                                this.logger.error("Download processing failed", err);
                                this.progressService.updateProgress(url, 0, 'failed');
                                observer.next('assets/placeholder_broken.png');
                                observer.complete();
                            }
                        }
                    },
                    error: (err) => {
                        // Keep .part file for retry (unless 4xx)
                        if (err.status && err.status >= 400 && err.status < 500) {
                            Filesystem.deleteFile({ path: partPath, directory: Directory.Cache }).catch(() => { });
                        }
                        this.progressService.updateProgress(url, 0, 'failed');
                        this.zoneRun(() => { observer.next(isExternal ? url : 'assets/placeholder_broken.png'); observer.complete(); });
                    }
                });
            });
        }).pipe(
            shareReplay(1),
            finalize(() => this.inProgress.delete(cacheKey))
        );

        this.inProgress.set(cacheKey, obs);
        return obs;
    }

    private async throttledVerify(url: string, cachedEtag: string, isPriority = false): Promise<{ status: 'match' | 'mismatch' | 'error' | 'backoff' }> {
        const retry = await this.storage.getMediaRetry(url);
        if (!isPriority && retry && Date.now() < retry.next_retry) return { status: 'backoff' };

        if (!isPriority && this.activeIntegrityChecks >= this.MAX_CONCURRENT_CHECKS) {
            return new Promise(resolve => {
                this.integrityQueue.push({ url, etag: cachedEtag, resolve });
            });
        }

        this.activeIntegrityChecks++;
        try {
            const res = await this.verifyIntegrity(url, cachedEtag);
            return res;
        } finally {
            this.activeIntegrityChecks--;
            this.processQueue();
        }
    }

    private processQueue() {
        if (this.integrityQueue.length > 0 && this.activeIntegrityChecks < this.MAX_CONCURRENT_CHECKS) {
            const next = this.integrityQueue.shift()!;
            this.throttledVerify(next.url, next.etag).then(res => next.resolve(res));
        }
    }

    private async handleIntegrityMismatch(url: string) {
        const retry = await this.storage.getMediaRetry(url) || { count: 0, next_retry: 0, last_logged: 0 };
        if (retry.count >= 5) {
            this.logger.error(`[SecureMedia][v8] Max retries reached for ${url.substring(0, 30)}...`);
            return;
        }

        const newCount = retry.count + 1;
        const delay = Math.min(30 * 60 * 1000, Math.pow(2, newCount - 1) * 60 * 1000);
        const nextRetry = Date.now() + delay;

        const now = Date.now();
        let lastLogged = retry.last_logged;

        if (now - lastLogged >= 60000) {
            const suppressed = this.suppressedLogs.get(url) || 0;
            this.logger.warn(`[SecureMedia][v8][RETRY] ${url.substring(0, 20)}... | Attempt: ${newCount}${suppressed > 0 ? ` | Suppressed: ${suppressed}` : ''}`);
            lastLogged = now;
            this.suppressedLogs.delete(url);
        } else {
            this.suppressedLogs.set(url, (this.suppressedLogs.get(url) || 0) + 1);
        }

        await this.storage.saveMediaRetry(url, newCount, nextRetry, lastLogged);
        this.storage.updateVerificationStatus(url, 'unverified');
    }

    private async verifyIntegrity(url: string, cachedEtag: string): Promise<{ status: 'match' | 'mismatch' | 'error' }> {
        try {
            const res = await fetch(url, { method: 'HEAD', headers: { 'If-None-Match': `"${cachedEtag}"` } });
            if (res.status === 304) return { status: 'match' };
            if (res.status === 200) return { status: 'mismatch' };
            return { status: 'error' };
        } catch { return { status: 'error' }; }
    }

    private checkExpirations() {
        const now = Date.now();
        this.cache.forEach((entry, key) => {
            if (now - entry.timestamp > 30 * 60 * 1000) this.zeroizeAndRemove(key);
        });
    }

    private zeroizeAndRemove(cacheKey: string) {
        const entry = this.cache.get(cacheKey);
        if (entry) {
            if (this.objectUrls.has(entry.url)) {
                URL.revokeObjectURL(entry.url);
                this.objectUrls.delete(entry.url);
            }
            if (entry.buffer) entry.buffer.fill(0);
            this.cache.delete(cacheKey);
        }
    }

    public clearCache(reason: 'LOGOUT' | 'BLOCKED' | 'REMOTE_KILL' | 'MANUAL' | 'destroy' = 'destroy'): void {
        this.cache.forEach((_, key) => this.zeroizeAndRemove(key));
        this.objectUrls.clear();
        this.cache.clear();
        this.inProgress.clear();
        this.suppressedLogs.clear();
        this.usageCounts.clear();

        if (['LOGOUT', 'BLOCKED', 'REMOTE_KILL'].includes(reason)) {
            this.storage.purgeAllMediaCache();
        }
    }

    public async uploadMedia(file: Blob, encrypt = false): Promise<any> {
        let blob = file;
        let ivBase64: string | undefined;
        let keyData: CryptoKey | undefined;

        if (encrypt) {
            const enc = await this.crypto.encryptBlob(file);
            blob = enc.encryptedBlob;
            ivBase64 = this.crypto.arrayBufferToBase64(enc.iv.buffer as ArrayBuffer);
            keyData = enc.key;
        }

        const formData = new FormData();
        formData.append('file', blob, encrypt ? 'secure_file.bin' : 'file');

        // Note: Using toPromise() as per project pattern, even if deprecated in RxJS 7
        const res: any = await this.api.post('upload.php', formData).toPromise();
        if (!res?.url) throw new Error('Upload failed');

        return {
            url: res.url,
            iv: ivBase64,
            mime: res.mime,
            _rawKey: keyData
        };
    }

    private async decryptMedia(blobEnc: Blob, keyEncBase64: string, ivBase64: string): Promise<Blob> {
        let rawKey: ArrayBuffer;
        if (keyEncBase64.startsWith('RAW:')) {
            rawKey = this.crypto.base64ToArrayBuffer(keyEncBase64.substring(4));
        } else {
            const priv = localStorage.getItem('private_key');
            if (!priv) throw new Error('No private key');
            const privKey = await this.crypto.importKey(priv, 'private');
            const keyBuf = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKey, this.crypto.base64ToArrayBuffer(keyEncBase64));
            rawKey = this.crypto.base64ToArrayBuffer(new TextDecoder().decode(keyBuf));
            new Uint8Array(keyBuf).fill(0);
        }

        const aesKey = await window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, true, ['decrypt']);
        const ivBuffer = this.crypto.base64ToArrayBuffer(ivBase64);
        const iv = new Uint8Array(ivBuffer);
        const decryptedBlob = await this.crypto.decryptBlob(blobEnc, aesKey, iv);

        new Uint8Array(rawKey).fill(0);
        iv.fill(0);
        return decryptedBlob;
    }

    public releaseMedia(url: string): void {
        const count = (this.usageCounts.get(url) || 1) - 1;
        if (count <= 0) {
            this.usageCounts.delete(url);
            const userId = localStorage.getItem('user_id') || 'anon';
            this.cache.forEach((entry, key) => {
                if (key.includes(`::${url}::`) && entry.url.startsWith('blob:')) {
                    this.zeroizeAndRemove(key);
                }
            });
        } else {
            this.usageCounts.set(url, count);
        }
    }

    private async appendPart(path: string, blob: Blob, isAppend: boolean) {
        if (!Capacitor.isNativePlatform()) return; // Web: Memory only (handled by browser cache usually, or not supported)

        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                try {
                    if (isAppend) {
                        await Filesystem.appendFile({ path, data: base64data, directory: Directory.Cache });
                    } else {
                        // Overwrite/Create
                        await Filesystem.writeFile({ path, data: base64data, directory: Directory.Cache });
                    }
                    resolve();
                } catch (e) { reject(e); }
            };
            reader.onerror = reject;
        });
    }

    private zoneRun(fn: Function) {
        this.zone.run(() => fn());
    }
}
