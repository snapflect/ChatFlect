import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SecureMediaService } from './secure-media.service';
import { ApiService } from './api.service';
import { CryptoService } from './crypto.service';
import { LoggingService } from './logging.service';
import { of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

// Mock Classes
class MockApiService {
    getBlob(url: string) { return of(new Blob(['test'])); }
    post(url: string, data: any) { return of({ url: 'uploads/test.png' }); }
}

class MockCryptoService {
    encryptBlob(blob: Blob) {
        return Promise.resolve({
            encryptedBlob: blob,
            key: {} as CryptoKey,
            iv: new Uint8Array(12)
        });
    }
    arrayBufferToBase64(buffer: ArrayBuffer) { return 'base64iv'; }
    importKey(keyStr: string, type: string) { return Promise.resolve({} as CryptoKey); }
    base64ToArrayBuffer(str: string) { return new ArrayBuffer(16); }
    decryptBlob(blob: Blob, key: CryptoKey, iv: Uint8Array) { return Promise.resolve(blob); }
}

class MockLoggingService {
    error(msg: string, err: any) { }
    log(msg: string, data?: any) { }
}

describe('SecureMediaService', () => {
    let service: SecureMediaService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                SecureMediaService,
                { provide: ApiService, useClass: MockApiService },
                { provide: CryptoService, useClass: MockCryptoService },
                { provide: LoggingService, useClass: MockLoggingService },
                {
                    provide: DomSanitizer,
                    useValue: {
                        bypassSecurityTrustUrl: (url: string) => url,
                        sanitize: () => 'safeString'
                    }
                }
            ]
        });
        service = TestBed.inject(SecureMediaService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should pass through absolute URLs (http/https)', (done) => {
        const url = 'https://example.com/image.jpg';
        service.getMedia(url).subscribe(res => {
            expect(res).toBe(url);
            done();
        });
    });

    it('should support serve.php?file= URLs', (done) => {
        const url = 'serve.php?file=uploads%2Ftest.jpg';
        spyOn(TestBed.inject(ApiService), 'getBlob').and.callThrough();

        service.getMedia(url).subscribe(res => {
            // Mock returns blob object URL
            expect(res).toBeDefined();
            done();
        });
    });

    it('should pass through data/blob/assets URLs', (done) => {
        const url = 'assets/logo.png';
        service.getMedia(url).subscribe(res => {
            expect(res).toBe(url);
            done();
        });
    });

    it('should return placeholder for empty URL', (done) => {
        service.getMedia('').subscribe(result => {
            expect(result).toContain('assets/placeholder_broken.png');
            done();
        });
    });

    it('should revoke object URL', () => {
        const spy = spyOn(URL, 'revokeObjectURL');
        const fakeUrl = 'blob:fake-url';

        (service as any).objectUrls.add(fakeUrl);
        service.revokeObjectUrl(fakeUrl);
        expect(spy).toHaveBeenCalledWith(fakeUrl);
    });
});
