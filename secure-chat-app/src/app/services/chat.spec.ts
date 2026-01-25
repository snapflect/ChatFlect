import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { ToastController, ModalController, ActionSheetController } from '@ionic/angular';
import { of, BehaviorSubject } from 'rxjs';

class TestChatService extends ChatService {
  protected override initFirestore() { }
  public override initHistorySyncLogic() { }
}

describe('ChatService', () => {
  let service: ChatService;
  let cryptoSpy: jasmine.SpyObj<CryptoService>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let loggerSpy: jasmine.SpyObj<LoggingService>;

  beforeEach(() => {
    cryptoSpy = jasmine.createSpyObj('CryptoService', [
      'decryptMessage', 'encryptPayload', 'encryptBlob', 'arrayBufferToBase64',
      'generateSessionKey', 'encryptAesKeyForRecipient', 'decryptPayload', 'decryptAesKeyFromSender'
    ]);
    apiSpy = jasmine.createSpyObj('ApiService', ['post', 'get']);
    authSpy = jasmine.createSpyObj('AuthService', [], {
      blockedUsers$: new BehaviorSubject<string[]>([]),
      currentUserId: new BehaviorSubject<string>('me')
    });
    loggerSpy = jasmine.createSpyObj('LoggingService', ['error', 'log']);

    TestBed.configureTestingModule({
      providers: [
        { provide: ChatService, useClass: TestChatService },
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
      if (key === 'private_key') return 'mock_priv_key';
      if (key === 'public_key') return 'mock_pub_key';
      if (key === 'device_uuid') return 'dev_uuid';
      return null;
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Phase 2: Multi-Device Payload', () => {
    it('should distribute secure payload correctly', async () => {
      const chatId = 'c1';

      // Mock getChatDoc to return participants
      spyOn<any>(service, 'getChatDoc').and.returnValue(Promise.resolve({
        exists: () => true,
        data: () => ({ participants: ['me', 'other'] })
      }));
      spyOn<any>(service, 'addMessageDoc').and.returnValue(Promise.resolve());
      spyOn<any>(service, 'updateChatDoc').and.returnValue(Promise.resolve());

      // Mock Keys: Return multiple devices for 'other'
      apiSpy.get.and.returnValue(of({
        'dev_a': 'pk_a',
        'dev_b': 'pk_b'
      }));

      cryptoSpy.generateSessionKey.and.returnValue(Promise.resolve('sess_key' as any));
      cryptoSpy.encryptPayload.and.returnValue(Promise.resolve('encrypted_text'));
      cryptoSpy.arrayBufferToBase64.and.returnValue('iv_64');
      cryptoSpy.encryptAesKeyForRecipient.and.returnValue(Promise.resolve('enc_sess_key'));

      await service.distributeSecurePayload(chatId, 'me', 'text', 'Hello', 'iv_64', 'sess_key' as any, {});

      // Logic check: api.get called for keys
      expect(apiSpy.get).toHaveBeenCalled();
      // Logic check: addMessageDoc called with encrypted content
      const addArgs = (service['addMessageDoc'] as jasmine.Spy).calls.mostRecent().args;
      expect(addArgs[1].ciphertext).toBe('encrypted_text');
    });
  });

  describe('Phase 3: View Once', () => {
    it('should set viewOnce flag', async () => {
      spyOn<any>(service, 'addMessageDoc').and.returnValue(Promise.resolve());
      spyOn<any>(service, 'updateChatDoc').and.returnValue(Promise.resolve());
      spyOn<any>(service, 'getChatDoc').and.returnValue(Promise.resolve({ exists: () => true, data: () => ({ participants: ['me'] }) }));
      apiSpy.get.and.returnValue(of({ 'd': 'k' }));

      cryptoSpy.generateSessionKey.and.returnValue(Promise.resolve('k' as any));
      cryptoSpy.encryptPayload.and.returnValue(Promise.resolve('c'));
      cryptoSpy.arrayBufferToBase64.and.returnValue('iv');

      await service.sendVideoMessage('c1', new Blob(), 'me', 10, null, 'cap', true);

      const addArgs = (service['addMessageDoc'] as jasmine.Spy).calls.mostRecent().args;
      expect(addArgs[1].viewOnce).toBeTrue();
    });
  });

  describe('Phase 4: History Sync', () => {
    it('should add sync request', async () => {
      spyOn<any>(service, 'fsAddDoc').and.returnValue(Promise.resolve());
      spyOn<any>(service, 'fsCollection').and.returnValue({});

      await service.requestHistorySync('me');

      expect(service['fsAddDoc']).toHaveBeenCalled();
    });
  });

});
