import { TestBed } from '@angular/core/testing';
import { LinkService } from './link.service';
import { LoggingService } from './logging.service';
import { CryptoService } from './crypto.service';
import { of } from 'rxjs';

const firestore = require('firebase/firestore');

describe('LinkService', () => {
    let service: LinkService;
    let loggerSpy: jasmine.SpyObj<LoggingService>;
    let cryptoSpy: jasmine.SpyObj<CryptoService>;

    beforeEach(() => {
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error', 'log']);
        cryptoSpy = jasmine.createSpyObj('CryptoService', ['arrayBufferToBase64', 'importKey', 'base64ToArrayBuffer']);

        // Mock Firebase
        const mockFirestoreFunctions = [
            'getFirestore', 'doc', 'onSnapshot', 'setDoc', 'deleteDoc'
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
                LinkService,
                { provide: LoggingService, useValue: loggerSpy },
                { provide: CryptoService, useValue: cryptoSpy }
            ]
        });
        service = TestBed.inject(LinkService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should generate a link session with RSA keys', async () => {
        const session = await service.generateLinkSession();
        expect(session.sessionId).toBeTruthy();
        expect(session.publicKey).toBeTruthy();
        expect(session.privateKey).toBeTruthy();
    });

    it('should listen for sync responses', (done) => {
        const mockData = { payload: 'enc' };
        (firestore.onSnapshot as jasmine.Spy).and.callFake((ref: any, cb: any) => {
            cb({ exists: () => true, data: () => mockData });
            return () => { };
        });

        service.listenForSync('id').subscribe(data => {
            expect(data).toEqual(mockData);
            done();
        });
    });

    it('should cleanup session', async () => {
        await service.cleanup('id');
        expect(firestore.deleteDoc).toHaveBeenCalled();
    });
});
