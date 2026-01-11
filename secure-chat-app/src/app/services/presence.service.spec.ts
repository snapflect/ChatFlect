import { TestBed } from '@angular/core/testing';
import { PresenceService } from './presence.service';
import { LoggingService } from './logging.service';
import { of } from 'rxjs';

const firestore = require('firebase/firestore');

describe('PresenceService', () => {
    let service: PresenceService;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error']);

        // Mock Firebase Firestore functions
        const firestoreMock = firestore as any;
        const mockFunctions = [
            'getFirestore', 'doc', 'setDoc', 'updateDoc', 'onSnapshot',
            'serverTimestamp', 'deleteField'
        ];

        mockFunctions.forEach(fn => {
            const implementation = (...args: any[]) => {
                if (fn === 'setDoc' || fn === 'updateDoc') return Promise.resolve();
                if (fn === 'onSnapshot') return () => { };
                if (fn === 'serverTimestamp') return 'mock_timestamp' as any;
                if (fn === 'deleteField') return 'delete' as any;
                return {};
            };

            try {
                if (jasmine.isSpy(firestoreMock[fn])) {
                    firestoreMock[fn].and.callFake(implementation);
                } else {
                    spyOn(firestore, fn as any).and.callFake(implementation);
                }
            } catch (e) {
                try {
                    Object.defineProperty(firestore, fn, {
                        value: jasmine.createSpy(fn).and.callFake(implementation),
                        configurable: true,
                        writable: true
                    });
                } catch (e2) {
                    console.warn(`Failed to mock ${fn}:`, e2);
                }
            }
        });


        spyOn(localStorage, 'getItem').and.callFake(key => {
            if (key === 'user_id') return 'my_id';
            return null;
        });

        TestBed.configureTestingModule({
            providers: [
                PresenceService,
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });
        service = TestBed.inject(PresenceService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should set global presence status', async () => {
        await service.setPresence('online');
        expect(firestore.setDoc).toHaveBeenCalledWith(jasmine.any(Object), jasmine.objectContaining({
            state: 'online',
            platform: 'mobile'
        }), { merge: true });
    });

    it('should watch another user status', (done) => {
        (firestore.onSnapshot as jasmine.Spy).and.callFake((ref: any, cb: any) => {
            cb({ data: () => ({ state: 'online' }) });
            return () => { };
        });

        service.getPresence('user1').subscribe(data => {
            expect(data.state).toBe('online');
            done();
        });
    });

    it('should set typing status in chat doc', async () => {
        await service.setTyping('chat1', true);
        expect(firestore.updateDoc).toHaveBeenCalled();
    });
});
