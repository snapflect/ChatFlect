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

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private injector: Injector) { }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        const userId = localStorage.getItem('user_id');
        const idToken = localStorage.getItem('id_token');

        let authReq = this.addAuthHeader(request, userId, idToken);

        return next.handle(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status === 401) {
                    // Start token refresh flow
                    const authService = this.injector.get(AuthService);
                    return from(authService.refreshToken()).pipe(
                        switchMap(newToken => {
                            if (newToken) {
                                // Retry with new token
                                const retryReq = this.addAuthHeader(request, userId, newToken);
                                return next.handle(retryReq);
                            }
                            // Redirect to login or logout if refresh fails
                            authService.logout();
                            return throwError(() => error);
                        })
                    );
                }

                if (error.status === 403) {
                    // v8.1: Account Blocked
                    const authService = this.injector.get(AuthService);
                    authService.logout();
                    alert("This account has been blocked. Please contact support.");
                }

                return throwError(() => error);
            })
        );
    }

    private addAuthHeader(request: HttpRequest<any>, userId: string | null, token: string | null): HttpRequest<any> {
        if (!userId) return request;

        const authToken = token || userId;
        return request.clone({
            setHeaders: {
                'Authorization': `Bearer ${authToken}`,
                'X-User-ID': userId
            }
        });
    }
}
