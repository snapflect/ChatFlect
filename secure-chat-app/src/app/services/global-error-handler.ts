import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { LoggingService } from './logging.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

    // Injector used to avoid Cyclic Dependency error if LoggingService uses HttpClient -> which uses ErrorHandler...
    constructor(private injector: Injector) { }

    handleError(error: any): void {
        const logger = this.injector.get(LoggingService);
        // Extract status if available (HttpErrorResponse)
        const status = error?.status || error?.rejection?.status;

        if (status === 403) {
            logger.warn('Global 403 Detected - Forcing Logout');

            // Standard pattern: Import lazily to avoid circular dependency
            import('./auth.service').then(m => {
                const auth = this.injector.get(m.AuthService);
                auth.logout();
                // Optional: Check if the error message implies "Blocked" vs "Revoked"
                // For now, generic message is safer
                alert('Session expired or device revoked. Please log in again.');
            });
            return;
        }

        const message = error.message ? error.message : error.toString();
        logger.error('Unhandled Exception:', error);
    }
}
