import { Injectable, Injector } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, from, timer } from 'rxjs';
import { catchError, switchMap, timeout } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LoggingService } from '../services/logging.service';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(
        private injector: Injector,
        private logger: LoggingService
    ) { }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        // Skip interception for non-API URLs (Firebase, Google, etc.)
        if (!request.url.includes(environment.apiUrl)) {
            return next.handle(request);
        }

        const userId = localStorage.getItem('user_id');

        // Skip 401 handling if user isn't logged in (pre-auth requests are expected to 401)
        if (!userId) {
            return next.handle(request);
        }

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

                    // Mutex implementation with 5s timeout to prevent hanging
                    return from(authService.refreshToken()).pipe(
                        timeout(5000),
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
                            // Only logout on explicit auth rejection from server
                            const status = refreshErr?.status || refreshErr?.error?.status;
                            if (status === 401 || status === 403) {
                                this.logger.error('[AuthInterceptor] Server rejected refresh (401/403). Logging out.', refreshErr);
                                authService.logout();
                            } else if (refreshErr?.name === 'TimeoutError') {
                                this.logger.warn('[AuthInterceptor] Refresh timed out (5s). Will retry on next request.');
                            } else {
                                // Network error (status 0), server error (5xx), or timeout
                                // Do NOT logout — transient issue, just propagate the error
                                this.logger.warn('[AuthInterceptor] Refresh failed (non-auth). Not logging out.', {
                                    status: refreshErr?.status,
                                    name: refreshErr?.name
                                });
                            }
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
