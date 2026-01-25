import { Injectable, OnDestroy } from '@angular/core';
import { ApiService } from './api.service';
import { CryptoService } from './crypto.service';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError, shareReplay, finalize } from 'rxjs/operators';
import { LoggingService } from './logging.service';

@Injectable({ providedIn: 'root' })
export class SecureMediaService implements OnDestroy {

    private cache = new Map<string, string>();
    private inProgress = new Map<string, Observable<string>>();
    private objectUrls = new Set<string>();

    constructor(
        private api: ApiService,
        private crypto: CryptoService,
        private logger: LoggingService
    ) { }

    ngOnDestroy(): void {
        this.clearCache();
    }

    getMedia(url: string, key?: string, iv?: string): Observable<string> {
        if (!url || typeof url !== 'string') return of('assets/placeholder_broken.png');

        const userId = localStorage.getItem('user_id') || 'anon';
        const cacheKey = `${userId}::${url}::${key || ''}::${iv || ''}`;

        if (this.cache.has(cacheKey)) {
            return of(this.cache.get(cacheKey)!);
        }

        if (
            url.startsWith('assets/') ||
            url.startsWith('data:') ||
            url.startsWith('blob:') ||
            url.includes('googleusercontent.com')
        ) {
            this.logger.log(`[SecureMedia] Bypassing blob download for trusted URL: ${url}`);
            return of(url);
        }

        if (this.inProgress.has(cacheKey)) {
            return this.inProgress.get(cacheKey)!;
        }

        const obs = this.api.getBlob(url).pipe(
            switchMap(async blob => {
                if (!blob || blob.size === 0) throw new Error('Empty blob');

                if (key && iv) {
                    return this.decryptMedia(blob, key, iv);
                }
                return blob;
            }),
            map(blob => {
                const objectUrl = URL.createObjectURL(blob);

                // Revoke old cached URL if exists
                const old = this.cache.get(cacheKey);
                if (old && this.objectUrls.has(old)) {
                    URL.revokeObjectURL(old);
                    this.objectUrls.delete(old);
                }

                this.objectUrls.add(objectUrl);
                this.cache.set(cacheKey, objectUrl);
                return objectUrl;
            }),
            catchError(err => {
                this.logger.error(`SecureMedia Load Error: ${url}`, err);
                // ❗ DO NOT cache placeholder
                return of('assets/placeholder_broken.png');
            }),
            finalize(() => {
                this.inProgress.delete(cacheKey);
            }),
            shareReplay(1)
        );

        this.inProgress.set(cacheKey, obs);
        return obs;
    }

    clearCache(): void {
        this.objectUrls.forEach(url => URL.revokeObjectURL(url));
        this.objectUrls.clear();
        this.cache.clear();
        this.inProgress.clear();
    }

    async uploadMedia(file: Blob, encrypt = false): Promise<any> {
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

        const res: any = await this.api.post('upload.php', formData).toPromise();
        if (!res?.url) throw new Error('Upload failed');

        return {
            url: res.url,
            iv: ivBase64,
            mime: res.mime,
            // @ts-ignore
            _rawKey: keyData
        };
    }

    private async decryptMedia(blobEnc: Blob, keyEncBase64: string, ivBase64: string): Promise<Blob> {
        // Check for Raw Key (No RSA Decryption needed) - Fix for "atob" error
        if (keyEncBase64.startsWith('RAW:')) {
            const rawKeyBase64 = keyEncBase64.substring(4);
            const rawKey = this.crypto.base64ToArrayBuffer(rawKeyBase64);

            const aesKey = await window.crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM' },
                true,
                ['decrypt']
            );

            const iv = new Uint8Array(this.crypto.base64ToArrayBuffer(ivBase64));
            return this.crypto.decryptBlob(blobEnc, aesKey, iv);
        }

        const priv = localStorage.getItem('private_key');
        if (!priv) throw new Error('No private key');

        const privKey = await this.crypto.importKey(priv, 'private');

        const keyBuf = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privKey,
            this.crypto.base64ToArrayBuffer(keyEncBase64)
        );

        const rawKey = this.crypto.base64ToArrayBuffer(new TextDecoder().decode(keyBuf));

        const aesKey = await window.crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM' },
            true,
            ['decrypt']
        );

        const iv = new Uint8Array(this.crypto.base64ToArrayBuffer(ivBase64));
        return this.crypto.decryptBlob(blobEnc, aesKey, iv);
    }

    /**
 * Revoke a previously created object URL
 * Called by SecureSrcDirective on reuse / destroy
 */
    public revokeObjectUrl(objectUrl: string): void {
        if (this.objectUrls.has(objectUrl)) {
            URL.revokeObjectURL(objectUrl);
            this.objectUrls.delete(objectUrl);
        }
    }

}
