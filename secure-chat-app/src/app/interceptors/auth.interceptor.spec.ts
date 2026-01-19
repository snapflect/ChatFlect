import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';

describe('AuthInterceptor', () => {
    let httpMock: HttpTestingController;
    let httpClient: HttpClient;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                {
                    provide: HTTP_INTERCEPTORS,
                    useClass: AuthInterceptor,
                    multi: true
                }
            ]
        });

        httpMock = TestBed.inject(HttpTestingController);
        httpClient = TestBed.inject(HttpClient);
    });

    afterEach(() => {
        httpMock.verify();
        localStorage.clear();
    });

    it('should add Authorization header when user_id exists', () => {
        localStorage.setItem('user_id', '12345');

        httpClient.get('/test-api').subscribe(response => expect(response).toBeTruthy());

        const req = httpMock.expectOne('/test-api');
        expect(req.request.headers.has('Authorization')).toBeTrue();
        expect(req.request.headers.get('Authorization')).toBe('Bearer 12345');
        expect(req.request.headers.get('X-User-ID')).toBe('12345');
        req.flush({});
    });

    it('should NOT add Authorization header when user_id is missing', () => {
        localStorage.removeItem('user_id');

        httpClient.get('/test-api').subscribe(response => expect(response).toBeTruthy());

        const req = httpMock.expectOne('/test-api');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        req.flush({});
    });
});
