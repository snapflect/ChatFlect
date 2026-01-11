import { TestBed } from '@angular/core/testing';
import { LoggingService } from './logging.service';
import { ApiService } from './api.service';
import { of, throwError } from 'rxjs';

describe('LoggingService', () => {
    let service: LoggingService;
    let apiSpy: jasmine.SpyObj<ApiService>;

    beforeEach(() => {
        apiSpy = jasmine.createSpyObj('ApiService', ['post']);

        TestBed.configureTestingModule({
            providers: [
                LoggingService,
                { provide: ApiService, useValue: apiSpy }
            ]
        });
        service = TestBed.inject(LoggingService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should log info messages and send to backend', () => {
        apiSpy.post.and.returnValue(of({}));
        const spy = spyOn(console, 'log');

        service.log('test info', { data: 1 });

        expect(spy).toHaveBeenCalled();
        expect(apiSpy.post).toHaveBeenCalledWith('log_error.php', jasmine.objectContaining({
            level: 'INFO',
            message: 'test info'
        }));
    });

    it('should log warn messages and send to backend', () => {
        apiSpy.post.and.returnValue(of({}));
        const spy = spyOn(console, 'warn');

        service.warn('test warn', { data: 2 });

        expect(spy).toHaveBeenCalled();
        expect(apiSpy.post).toHaveBeenCalledWith('log_error.php', jasmine.objectContaining({
            level: 'WARN',
            message: 'test warn'
        }));
    });

    it('should log error messages and send to backend', () => {
        apiSpy.post.and.returnValue(of({}));
        const spy = spyOn(console, 'error');

        service.error('test error', new Error('fail'));

        expect(spy).toHaveBeenCalled();
        expect(apiSpy.post).toHaveBeenCalledWith('log_error.php', jasmine.objectContaining({
            level: 'ERROR',
            message: 'test error'
        }));
    });

    it('should handle error object safely in error log', () => {
        apiSpy.post.and.returnValue(of({}));
        const err = new Error('structured error');
        service.error('test error', err);

        const callArgs = apiSpy.post.calls.mostRecent().args[1];
        expect(callArgs.context.message).toBe('structured error');
        expect(callArgs.context.stack).toBeDefined();
    });

    it('should handle API failure gracefully', () => {
        apiSpy.post.and.returnValue(throwError(() => new Error('API Down')));
        const spy = spyOn(console, 'error');

        service.log('test silent failure');

        expect(spy).toHaveBeenCalledWith('Failed to send log', jasmine.any(Error));
    });
});
