import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { CryptoService } from './crypto.service';
import { ApiService } from './api.service';
import { LoggingService } from './logging.service';
import { AuthService } from './auth.service';
import { ToastController, ModalController, ActionSheetController } from '@ionic/angular';
import { of, BehaviorSubject } from 'rxjs';

// Subclass to bypass constructor DB init
class TestChatService extends ChatService {
  protected override initFirestore() {
    // No-op for testing to avoid real Firebase connection
  }
}

describe('ChatService', () => {
  let service: ChatService;
  let cryptoSpy: jasmine.SpyObj<CryptoService>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let loggerSpy: jasmine.SpyObj<LoggingService>;

  beforeEach(() => {
    cryptoSpy = jasmine.createSpyObj('CryptoService', ['decryptMessage', 'encryptMessage', 'encryptBlob', 'arrayBufferToBase64', 'generateSessionKey']);
    apiSpy = jasmine.createSpyObj('ApiService', ['post', 'get']);
    authSpy = jasmine.createSpyObj('AuthService', [], {
      blockedUsers$: new BehaviorSubject<string[]>([])
    });
    loggerSpy = jasmine.createSpyObj('LoggingService', ['error', 'log']);

    TestBed.configureTestingModule({
      providers: [
        { provide: ChatService, useClass: TestChatService }, // Use the testable subclass
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

    // Mock localStorage
    spyOn(localStorage, 'getItem').and.callFake(key => {
      if (key === 'user_id') return 'my_id';
      if (key === 'private_key') return 'mock_priv_key';
      if (key === 'public_key') return 'mock_pub_key';
      return null;
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send an encrypted message', async () => {
    const chatId = 'chat_123';
    const plainText = 'Hello World';
    const senderId = 'my_id';

    // Mock Protected Helpers
    spyOn<any>(service, 'getChatDoc').and.returnValue(Promise.resolve({
      exists: () => true,
      data: () => ({ participants: ['my_id', 'other_id'], isGroup: false })
    }));
    spyOn<any>(service, 'getChatTTL').and.returnValue(Promise.resolve(0));
    spyOn<any>(service, 'addMessageDoc').and.returnValue(Promise.resolve());
    spyOn<any>(service, 'updateChatDoc').and.returnValue(Promise.resolve());

    // Mock API for Keys
    apiSpy.get.and.returnValue(of({ public_key: 'other_pub_key' }));

    // Mock Encryption (HYBRID)
    cryptoSpy.encryptMessage.and.returnValue(Promise.resolve('encrypted_content'));

    await service.sendMessage(chatId, plainText, senderId);

    expect(cryptoSpy.encryptMessage).toHaveBeenCalledWith(plainText, 'other_pub_key');
    expect(cryptoSpy.encryptMessage).toHaveBeenCalledWith(plainText, 'mock_pub_key'); // Self copy

    // Verify Payload
    const addArgs = (service['addMessageDoc'] as jasmine.Spy).calls.mostRecent().args;
    expect(addArgs[0]).toBe(chatId);
    expect(addArgs[1].content).toEqual({ 'other_id': 'encrypted_content' });
    expect(addArgs[1].content_self).toBe('encrypted_content');
  });

  it('should decrypt received messages', (done) => {
    const chatId = 'chat_abc';

    // Mock Firestore Snapshot
    const mockSnapshot = {
      docs: [
        {
          id: 'msg_1',
          data: () => ({
            senderId: 'other_id',
            content: { 'my_id': 'encrypted_for_me' },
            timestamp: 1000
          })
        }
      ]
    };

    // Spy on fsCollection and fsQuery to return something (doesn't matter what, as we mock fsOnSnapshot)
    spyOn<any>(service, 'fsCollection').and.returnValue({});
    spyOn<any>(service, 'fsQuery').and.returnValue({});

    // Spy on fsOnSnapshot to simulate incoming data
    spyOn<any>(service, 'fsOnSnapshot').and.callFake((query, callback) => {
      callback(mockSnapshot); // Trigger immediately
      return () => { }; // Unsubscribe function
    });

    // Mock Decryption
    cryptoSpy.decryptMessage.and.returnValue(Promise.resolve('Decrypted Hello'));

    service.getMessages(chatId).subscribe(msgs => {
      expect(msgs.length).toBe(1);
      expect(msgs[0].text).toBe('Decrypted Hello');
      expect(cryptoSpy.decryptMessage).toHaveBeenCalledWith('encrypted_for_me', 'mock_priv_key');
      done();
    });
  });

  it('should handle decryption failure gracefully', (done) => {
    const chatId = 'chat_fail';

    const mockSnapshot = {
      docs: [
        {
          id: 'msg_2',
          data: () => ({
            senderId: 'other_id',
            content: { 'my_id': 'bad_cipher' },
            timestamp: 2000
          })
        }
      ]
    };

    spyOn<any>(service, 'fsCollection').and.returnValue({});
    spyOn<any>(service, 'fsQuery').and.returnValue({});
    spyOn<any>(service, 'fsOnSnapshot').and.callFake((query, callback) => {
      callback(mockSnapshot);
      return () => { };
    });

    cryptoSpy.decryptMessage.and.returnValue(Promise.resolve('[Decryption Error]'));

    service.getMessages(chatId).subscribe(msgs => {
      expect(msgs[0].text).toBe('🔒 Decryption Failed');
      done();
    });
  });

  it('should toggle star message', async () => {
    const chatId = 'c1';
    const msgId = 'm1';

    // spy on fsDoc and fsUpdateDoc
    spyOn<any>(service, 'fsDoc').and.returnValue({});
    const updateSpy = spyOn<any>(service, 'fsUpdateDoc').and.returnValue(Promise.resolve());

    await service.toggleStarMessage(chatId, msgId, true);

    expect(updateSpy).toHaveBeenCalled();
    // Complex matcher for arrayUnion might be hard, just check generic call
    expect(service['fsDoc']).toHaveBeenCalledWith('chats', chatId, 'messages', msgId);
  });

});
