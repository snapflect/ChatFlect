import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor() { }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        // Get the user ID from local storage (or AuthService if circular dependency can be avoided)
        const userId = localStorage.getItem('user_id');
        const idToken = localStorage.getItem('id_token');

        let headers = request.headers;

        if (userId) {
            // Priority: id_token (JWT) for Authorization Bearer
            // Fallback: user_id for Bearer (if no JWT exists)
            const token = idToken || userId;
            headers = headers.set('Authorization', `Bearer ${token}`)
                .set('X-User-ID', userId);
        }

        // Clone the request with the new headers
        const authReq = request.clone({ headers });

        return next.handle(authReq);
    }
}
