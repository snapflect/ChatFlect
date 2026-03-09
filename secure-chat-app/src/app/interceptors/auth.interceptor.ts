import { Injectable, Injector } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LoggingService } from '../services/logging.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(
        private injector: Injector,
        private logger: LoggingService
    ) { }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        const userId = localStorage.getItem('user_id');
        // Cookie Migration: Stop reading token from LocalStorage
        // const idToken = localStorage.getItem('id_token'); 

        const authReq = this.addAuthHeader(request, userId, null);

        return next.handle(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status === 401) {
                    const authService = this.injector.get(AuthService);
                    const refreshAttempt = parseInt(request.headers.get('X-Refresh-Attempt') || '0', 10);

                    if (refreshAttempt >= 3) {
                        this.logger.error('[AuthInterceptor] Maximum refresh attempts (3) reached. Forcing logout.');
                        authService.logout();
                        return throwError(() => error);
                    }

                    // Mutex implementation in AuthService ensures only one refresh call
                    return from(authService.refreshToken()).pipe(
                        switchMap(() => {
                            // Retry with incremented attempt header
                            const retryReq = request.clone({
                                setHeaders: {
                                    'X-Refresh-Attempt': (refreshAttempt + 1).toString()
                                }
                            });
                            return next.handle(retryReq);
                        }),
                        catchError(refreshErr => {
                            this.logger.error('[AuthInterceptor] Refresh failed after mutex', refreshErr);
                            authService.logout();
                            return throwError(() => refreshErr);
                        })
                    );
                }

                if (error.status === 403) {
                    const errorBody = error.error;
                    if (errorBody?.status === 'blocked') {
                        const authService = this.injector.get(AuthService);
                        if (!(authService as any).userBlockedAlertShown) {
                            (authService as any).userBlockedAlertShown = true;
                            authService.logout();
                            alert("This account has been blocked. Please contact support.");
                        }
                    } else {
                        // Other 403s (Device Binding etc) are handled in background or ignored here
                        console.warn('[AuthInterceptor] 403 Forbidden (Not a block)', errorBody);
                    }
                }

                return throwError(() => error);
            })
        );
    }

    private addAuthHeader(request: HttpRequest<any>, userId: string | null, token: string | null): HttpRequest<any> {
        if (!userId) return request;

        const headers: any = {
            'X-User-ID': userId
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return request.clone({
            setHeaders: headers
        });
    }
}
