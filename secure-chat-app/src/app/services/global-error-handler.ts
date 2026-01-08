import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { LoggingService } from './logging.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

    // Injector used to avoid Cyclic Dependency error if LoggingService uses HttpClient -> which uses ErrorHandler...
    constructor(private injector: Injector) { }

    handleError(error: any): void {
        const logger = this.injector.get(LoggingService);
        const message = error.message ? error.message : error.toString();

        logger.error('Unhandled Exception:', error);

        // Rethrow if needed, or suppress
        // console.error(error); // Default browser behavior
    }
}
