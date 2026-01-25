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
  it('should verify OTP and generate keys (Phase 1)', async () => {
    // Mock Crypto
    const mockKp = { publicKey: {} as any, privateKey: {} as any };
    cryptoSpy.generateKeyPair.and.returnValue(Promise.resolve(mockKp));
    cryptoSpy.exportKey.and.returnValue(Promise.resolve('mock_key_str'));

    // Mock API
    apiSpy.post.and.returnValue(of({ status: 'success', user_id: 'u1' }));
    apiSpy.get.and.returnValue(of({ public_key: 'mock_key_str' }));

    const res = await service.verifyOtp('123', 'otp', 'email');

    expect(cryptoSpy.generateKeyPair).toHaveBeenCalled();
    expect(localStorage.setItem).toHaveBeenCalledWith('private_key', 'mock_key_str');
    expect(localStorage.setItem).toHaveBeenCalledWith('public_key', 'mock_key_str');
    expect(res.user_id).toBe('u1');
  });

  it('should register device on session set (Phase 2)', async () => {
    // Mock Device Info import? 
    // Usually hard to mock dynamic imports in simple jasmine.
    // However, AuthService uses `import('@capacitor/device').then(...)`.
    // We can just verify `api.post` is called.

    spyOn(service as any, 'getOrGenerateDeviceUUID').and.returnValue('dev_uuid');
    spyOn(localStorage, 'getItem').and.callFake(k => k === 'public_key' ? 'pk' : null);
    apiSpy.post.and.returnValue(of({ success: true }));

    await service.setSession('u1');

    // setSession calls registerDevice (no await).
    // wait a tick
    await new Promise(r => setTimeout(r, 10));

    expect(apiSpy.post).toHaveBeenCalledWith('devices.php?action=register', jasmine.objectContaining({
      user_id: 'u1',
      device_uuid: 'dev_uuid'
    }));
  });
});
