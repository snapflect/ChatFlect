import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { SecureMediaService } from './secure-media.service';
import { CryptoService } from './crypto.service';
import { TransferProgressService } from './transfer-progress.service';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ChunkedUploadService {
    private CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB
    private THRESHOLD = 2 * 1024 * 1024; // 2 MB
    private API_URL = 'https://chat.snapflect.com/api/v4/media/chunked_upload.php';

    constructor(
        private http: HttpClient,
        private secureMedia: SecureMediaService,
        private crypto: CryptoService,
        private progressService: TransferProgressService
    ) { }

    /**
     * Main entry point for file uploads.
     * Chunks if file > THRESHOLD.
     */
    async uploadFile(file: Blob, tempId: string, encrypt = true): Promise<any> {
        if (file.size < this.THRESHOLD) {
            // Fallback to existing single-shot upload logic (but integrated here)
            return this.uploadSingleShot(file, tempId, encrypt);
        }

        let blob = file;
        let ivBase64: string | undefined;
        let keyData: CryptoKey | undefined;

        if (encrypt) {
            const enc = await this.crypto.encryptBlob(file);
            blob = enc.encryptedBlob;
            ivBase64 = this.crypto.arrayBufferToBase64(enc.iv);
            keyData = enc.key;
        }

        const uploadId = window.crypto.randomUUID();
        const chunkCount = Math.ceil(blob.size / this.CHUNK_SIZE);

        // Calculate hash of final BLOB (encrypted if encrypt=true)
        const fileHash = await this.crypto.calculateHash(blob);

        // 1. Init
        await this.initUpload(uploadId, blob.size, chunkCount, file.name, fileHash);

        // 2. Upload Chunks
        for (let i = 0; i < chunkCount; i++) {
            const start = i * this.CHUNK_SIZE;
            const end = Math.min(start + this.CHUNK_SIZE, blob.size);
            const chunk = blob.slice(start, end);

            await this.uploadChunk(uploadId, i, chunk, tempId, blob.size);

            const percent = Math.round(((i + 1) / chunkCount) * 100);
            this.progressService.updateProgress(tempId, percent, 'uploading');
        }

        // 3. Finalize
        const res = await this.finalizeUpload(uploadId);

        return {
            url: res.url,
            iv: ivBase64,
            mime: res.mime || blob.type,
            key: keyData,
            filename: res.filename,
            hash: fileHash
        };
    }

    private async initUpload(uploadId: string, totalSize: number, chunkCount: number, filename: string, hash?: string) {
        const body = {
            action: 'init',
            upload_id: uploadId,
            total_size: totalSize,
            chunk_count: chunkCount,
            filename: filename,
            sha256_hash: hash
        };
        return firstValueFrom(this.http.post(`${this.API_URL}?action=init`, body));
    }

    private async uploadChunk(uploadId: string, index: number, chunk: Blob, tempId: string, totalSize: number) {
        const formData = new FormData();
        formData.append('upload_id', uploadId);
        formData.append('chunk_index', index.toString());
        formData.append('file', chunk, 'chunk.part');

        // Use retry logic here if needed
        let attempts = 0;
        while (attempts < 3) {
            try {
                return await firstValueFrom(this.http.post(`${this.API_URL}?action=chunk`, formData));
            } catch (e) {
                attempts++;
                if (attempts >= 3) throw e;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }
    }

    private async finalizeUpload(uploadId: string): Promise<any> {
        const body = { action: 'finalize', upload_id: uploadId };
        return firstValueFrom(this.http.post(`${this.API_URL}?action=finalize`, body));
    }

    private async uploadSingleShot(file: Blob, tempId: string, encrypt: boolean): Promise<any> {
        // We can reuse SecureMediaService logic or implement it here for better progress control
        // For now, let's implement it here to ensure it uses TransferProgressService correctly
        let blob = file;
        let ivBase64: string | undefined;
        let keyData: CryptoKey | undefined;

        if (encrypt) {
            const enc = await this.crypto.encryptBlob(file);
            blob = enc.encryptedBlob;
            ivBase64 = this.crypto.arrayBufferToBase64(enc.iv);
            keyData = enc.key;
        }

        const formData = new FormData();
        const ext = encrypt ? 'bin' : 'jpg'; // simplified
        formData.append('file', blob, `upload_${Date.now()}.${ext}`);

        const res: any = await firstValueFrom(this.http.post(`https://chat.snapflect.com/api/upload.php?mode=secure`, formData, {
            headers: new HttpHeaders({ 'X-Encrypted': '1' })
        }));

        const fileHash = await this.crypto.calculateHash(blob);

        return {
            url: (res as any).url,
            iv: ivBase64,
            mime: (res as any).mime || blob.type,
            key: keyData,
            hash: fileHash
        };
    }
}
