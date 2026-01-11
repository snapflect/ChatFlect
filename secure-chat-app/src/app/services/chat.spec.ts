import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { ToastController, ModalController, ActionSheetController } from '@ionic/angular';
import { of, BehaviorSubject } from 'rxjs';

// Use require to get a potentially writable object
import * as firestore from 'firebase/firestore';

describe('ChatService', () => {
  let service: ChatService;
  let cryptoSpy: jasmine.SpyObj<CryptoService>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let loggerSpy: jasmine.SpyObj<LoggingService>;
  let mockGetDocData: any = { exists: () => true, data: () => ({ participants: [] }) };

  beforeEach(() => {
    mockGetDocData = { exists: () => true, data: () => ({ participants: [] }) };
    cryptoSpy = jasmine.createSpyObj('CryptoService', ['decryptWithRatchet', 'encryptMessage', 'encryptWithRatchet', 'arrayBufferToBase64', 'encryptBlob', 'generateSessionKey', 'decryptBlob', 'importKey', 'base64ToArrayBuffer']);
    apiSpy = jasmine.createSpyObj('ApiService', ['post', 'get', 'getBlob']);
    authSpy = jasmine.createSpyObj('AuthService', [], {
      blockedUsers$: new BehaviorSubject<string[]>([])
    });
    loggerSpy = jasmine.createSpyObj('LoggingService', ['error', 'log']);

    // Mock Firebase Firestore functions
    const firestoreMock = firestore as any;
    const mockFunctions = [
      'getFirestore', 'collection', 'doc', 'query', 'onSnapshot',
      'setDoc', 'updateDoc', 'deleteDoc', 'addDoc', 'where',
      'getDocs', 'getDoc', 'increment'
    ];

    mockFunctions.forEach(fn => {
      const implementation = (...args: any[]) => {
        if (['setDoc', 'updateDoc', 'deleteDoc', 'addDoc'].includes(fn)) return Promise.resolve({ id: 'mock' });
        if (fn === 'onSnapshot') return () => { };
        if (fn === 'getDocs') return Promise.resolve({ docs: [] });
        if (fn === 'getDoc') return Promise.resolve(mockGetDocData);
        if (fn === 'increment') return 1 as any;
        return {};
      };

      try {
        if (jasmine.isSpy(firestoreMock[fn])) {
          firestoreMock[fn].and.callFake(implementation);
        } else {
          spyOn(firestore as any, fn).and.callFake(implementation);
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


    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: CryptoService, useValue: cryptoSpy },
        { provide: ApiService, useValue: apiSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: LoggingService, useValue: loggerSpy },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) },
        { provide: ActionSheetController, useValue: jasmine.createSpyObj('ActionSheetController', ['create']) }
      ]
    });

    service = TestBed.inject(ChatService);

    spyOn(localStorage, 'getItem').and.callFake(key => {
      if (key === 'user_id') return 'my_id';
      return null;
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send a message and update Firestore', async () => {
    const chatId = 'chat_123';
    const plainText = 'Hello';
    const senderId = 'my_id';

    // Spy on protected helper methods
    const getChatDocSpy = spyOn<any>(service, 'getChatDoc').and.returnValue(Promise.resolve({
      exists: () => true,
      data: () => ({ participants: ['my_id', 'other_id'], isGroup: false })
    }));
    const addMessageDocSpy = spyOn<any>(service, 'addMessageDoc').and.returnValue(Promise.resolve());
    const updateChatDocSpy = spyOn<any>(service, 'updateChatDoc').and.returnValue(Promise.resolve());

    apiSpy.get.and.returnValue(of({ public_key: 'abc' }));
    cryptoSpy.encryptWithRatchet.and.returnValue(Promise.resolve('encrypted'));

    await service.sendMessage(chatId, plainText, senderId);

    expect(getChatDocSpy).toHaveBeenCalledWith(chatId);
    expect(addMessageDocSpy).toHaveBeenCalled();
    expect(updateChatDocSpy).toHaveBeenCalled();

    expect(apiSpy.get).toHaveBeenCalled(); // Public key fetch
    expect(cryptoSpy.encryptWithRatchet).toHaveBeenCalled(); // Message encryption
  });
});
