import { TestBed } from '@angular/core/testing';
import { LocationService } from './location.service';
import { LoggingService } from './logging.service';
import { Geolocation } from '@capacitor/geolocation';
import { of } from 'rxjs';

const firestore = require('firebase/firestore');

describe('LocationService', () => {
    let service: LocationService;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error']);

        // Mock Firebase
        const mockFirestoreFunctions = [
            'getFirestore', 'collection', 'doc', 'setDoc', 'deleteDoc', 'onSnapshot'
        ];
        mockFirestoreFunctions.forEach(fn => {
            const implementation = (...args: any[]) => {
                if (fn === 'setDoc' || fn === 'deleteDoc') return Promise.resolve();
                if (fn === 'onSnapshot') return () => { };
                return {};
            };

            if (jasmine.isSpy(firestore[fn])) {
                (firestore[fn] as jasmine.Spy).and.callFake(implementation);
            } else {
                try {
                    spyOn(firestore, fn).and.callFake(implementation);
                } catch (e) {
                    const spy = jasmine.createSpy(fn).and.callFake(implementation);
                    try {
                        Object.defineProperty(firestore, fn, { value: spy, configurable: true, writable: true });
                    } catch (e2) {
                        (firestore as any)[fn] = spy;
                    }
                }
            }
        });

        TestBed.configureTestingModule({
            providers: [
                LocationService,
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });
        service = TestBed.inject(LocationService);

        spyOn(localStorage, 'getItem').and.returnValue('my_id');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should start sharing and watch position', async () => {
        const spy = jasmine.createSpy('watchPosition').and.returnValue(Promise.resolve('watch_123'));
        try {
            spyOn(Geolocation, 'watchPosition').and.returnValue(Promise.resolve('watch_123'));
        } catch (e) {
            Object.defineProperty(Geolocation, 'watchPosition', { value: spy, configurable: true, writable: true });
        }

        await service.startSharing('chat_123');
        expect(spy).toHaveBeenCalled();
    });

    it('should stop sharing and clear watch', async () => {
        // First start
        const watchSpy = jasmine.createSpy('watchPosition').and.returnValue(Promise.resolve('watch_123'));
        const clearSpy = jasmine.createSpy('clearWatch').and.returnValue(Promise.resolve());
        try {
            spyOn(Geolocation, 'watchPosition').and.returnValue(Promise.resolve('watch_123'));
            spyOn(Geolocation, 'clearWatch').and.returnValue(Promise.resolve());
        } catch (e) {
            Object.defineProperty(Geolocation, 'watchPosition', { value: watchSpy, configurable: true, writable: true });
            Object.defineProperty(Geolocation, 'clearWatch', { value: clearSpy, configurable: true, writable: true });
        }

        await service.startSharing('chat_123');
        await service.stopSharing();

        expect(clearSpy).toHaveBeenCalledWith({ id: 'watch_123' });
        expect(firestore.deleteDoc).toHaveBeenCalled();
    });

    it('should listen for locations in a chat', (done) => {
        (firestore.onSnapshot as jasmine.Spy).and.callFake((ref: any, cb: any) => {
            cb({ docs: [{ data: () => ({ lat: 10, lng: 20 }) }] });
            return () => { };
        });

        service.getLocations('chat_123').subscribe(locs => {
            expect(locs.length).toBe(1);
            expect(locs[0].lat).toBe(10);
            done();
        });
    });
});
