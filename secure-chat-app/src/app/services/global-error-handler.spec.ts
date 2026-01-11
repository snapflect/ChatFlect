import { TestBed } from '@angular/core/testing';
import { GlobalErrorHandler } from './global-error-handler';
import { LoggingService } from './logging.service';
import { Injector } from '@angular/core';

describe('GlobalErrorHandler', () => {
    let handler: GlobalErrorHandler;
    let loggingSpy: jasmine.SpyObj<LoggingService>;
    let injectorSpy: jasmine.SpyObj<Injector>;

    beforeEach(() => {
        loggingSpy = jasmine.createSpyObj('LoggingService', ['error']);
        injectorSpy = jasmine.createSpyObj('Injector', ['get']);

        TestBed.configureTestingModule({
            providers: [
                GlobalErrorHandler,
                { provide: LoggingService, useValue: loggingSpy },
                { provide: Injector, useValue: injectorSpy }
            ]
        });
        handler = TestBed.inject(GlobalErrorHandler);
    });

    it('should be created', () => {
        expect(handler).toBeTruthy();
    });

    it('should log unhandled exceptions using LoggingService', () => {
        injectorSpy.get.and.returnValue(loggingSpy);
        const error = new Error('test crash');

        handler.handleError(error);

        expect(loggingSpy.error).toHaveBeenCalledWith('Unhandled Exception:', error);
    });

    it('should handle string errors', () => {
        injectorSpy.get.and.returnValue(loggingSpy);
        const error = 'plain string error';

        handler.handleError(error);

        expect(loggingSpy.error).toHaveBeenCalledWith('Unhandled Exception:', error);
    });
});
