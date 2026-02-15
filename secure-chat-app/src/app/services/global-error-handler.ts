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
        const errorBody = error?.error || error?.rejection?.error;

        if (status === 403) {
            // Only force logout if explicitly blocked by admin
            if (errorBody?.status === 'blocked') {
                logger.warn('Global 403 Detected - Account Blocked, Forcing Logout');
                import('./auth.service').then(m => {
                    const auth = this.injector.get(m.AuthService);
                    // access private flag using type cast or check if exposed
                    if (!(auth as any).userBlockedAlertShown) {
                        (auth as any).userBlockedAlertShown = true;
                        auth.logout();
                        alert('This account has been blocked. Please contact support.');
                    }
                });
            } else {
                // Device/session 403s are handled by auth.service.ts directly
                logger.warn('Global 403 Detected - Device/Session issue (not blocking)', {
                    error: errorBody?.error || 'unknown'
                });
            }
            return;
        }

        const message = error.message ? error.message : error.toString();
        logger.error('Unhandled Exception:', error);
    }
}
