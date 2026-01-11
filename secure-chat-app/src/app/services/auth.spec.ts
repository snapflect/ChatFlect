import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { LoggingService } from './logging.service';
import { CryptoService } from './crypto.service';
import { PushService } from './push.service';
import { CallService } from './call.service';
import { of } from 'rxjs';

const firestore = require('firebase/firestore');

describe('AuthService', () => {
  let service: AuthService;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let cryptoSpy: jasmine.SpyObj<CryptoService>;
  let loggerSpy: jasmine.SpyObj<LoggingService>;
  let pushSpy: jasmine.SpyObj<PushService>;
  let callSpy: jasmine.SpyObj<CallService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['post', 'get']);
    cryptoSpy = jasmine.createSpyObj('CryptoService', ['generateKeyPair', 'exportKey']);
    loggerSpy = jasmine.createSpyObj('LoggingService', ['log', 'error']);
    pushSpy = jasmine.createSpyObj('PushService', ['syncToken']);
    callSpy = jasmine.createSpyObj('CallService', ['init']);

    // Mock Firebase
    const mockFirestoreFunctions = [
      'getFirestore', 'collection', 'doc', 'onSnapshot', 'getDoc', 'setDoc', 'deleteDoc'
    ];
    mockFirestoreFunctions.forEach(fn => {
      const implementation = (...args: any[]) => {
        if (fn === 'getDoc') return Promise.resolve({ exists: () => false, data: () => ({}) });
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
        AuthService,
        { provide: ApiService, useValue: apiSpy },
        { provide: CryptoService, useValue: cryptoSpy },
        { provide: LoggingService, useValue: loggerSpy },
        { provide: PushService, useValue: pushSpy },
        { provide: CallService, useValue: callSpy }
      ]
    });

    service = TestBed.inject(AuthService);

    spyOn(localStorage, 'getItem').and.callFake(key => null);
    spyOn(localStorage, 'setItem').and.callFake(() => { });
    spyOn(localStorage, 'removeItem').and.callFake(() => { });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
