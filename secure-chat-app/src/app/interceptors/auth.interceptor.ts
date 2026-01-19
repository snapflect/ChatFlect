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
        const privateKey = localStorage.getItem('private_key');

        let headers = request.headers;

        if (userId) {
            // "Top Notch": Send standardized headers
            // 1. Authorization: Bearer <user_id> (Classic)
            // 2. X-User-ID: <user_id> (Explicit)
            headers = headers.set('Authorization', `Bearer ${userId}`)
                .set('X-User-ID', userId);
        }

        // Clone the request with the new headers
        const authReq = request.clone({ headers });

        return next.handle(authReq);
    }
}
