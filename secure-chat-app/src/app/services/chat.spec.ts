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
    cryptoSpy = jasmine.createSpyObj('CryptoService', ['decryptWithRatchet', 'encryptMessage', 'encryptWithRatchet', 'arrayBufferToBase64', 'encryptBlob', 'generateSessionKey', 'decryptBlob', 'importKey', 'base64ToArrayBuffer', 'clearSession']);
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
          // If we cannot redefine, checks if it is already a spy and reuse it
          if (jasmine.isSpy(firestoreMock[fn])) {
            firestoreMock[fn].and.callFake(implementation);
          } else {
            console.warn(`Failed to mock ${fn}:`, e2);
          }
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

  // ... (Existing tests)

  it('should mark chat as read and set last_read timestamp', async () => {
    const chatId = 'c1';
    await service.markAsRead(chatId);
    expect(firestore.updateDoc).toHaveBeenCalled();
    // Verify the update object contains last_read_my_id
    const updateArgs = (firestore.updateDoc as jasmine.Spy).calls.mostRecent().args[1];
    expect(updateArgs['unread_my_id']).toBe(0);
    expect(updateArgs['last_read_my_id']).toBeDefined();
  });

  it('should get shared media', (done) => {
    // Mock getMessages (since getSharedMedia reuses it or queries messages)
    // Note: implementation of getSharedMedia currently calls collection(messages)
    (firestore.getDocs as jasmine.Spy).and.returnValue(Promise.resolve({
      docs: [
        { data: () => ({ id: 'm1', text: { type: 'image', url: 'http://img' }, timestamp: 100 }) },
        { data: () => ({ id: 'm2', text: { type: 'text', content: 'hi' }, timestamp: 200 }) }
      ]
    }));

    service.getSharedMedia('c1').subscribe(media => {
      expect(media.length).toBe(2); // It currently returns all messages, filtering happens in component usually, or if query is specific
      // If logic changes to specific query, adjust test. 
      // Current impl: const q = query(collection(this.db, 'chats', chatId, 'messages'), orderBy('timestamp', 'desc'));
      done();
    });
  });

  it('should toggle star message', async () => {
    await service.toggleStarMessage('c1', 'm1', true);
    expect(firestore.updateDoc).toHaveBeenCalled();
    const updateArgs = (firestore.updateDoc as jasmine.Spy).calls.mostRecent().args[1];
    // arrayUnion check would be ideal if we could inspect it
    expect(updateArgs).toBeDefined();
  });

  it('should get starred messages', (done) => {
    // Mock collectionGroup query result
    (firestore.getDocs as jasmine.Spy).and.returnValue(Promise.resolve({
      docs: [
        { data: () => ({ id: 'm1', starredBy: ['my_id'] }) }
      ]
    }));

    service.getStarredMessages().subscribe(msgs => {
      expect(msgs.length).toBe(1);
      done();
    });
  });

  it('should trigger session retry when decryption fails with ERROR_RATCHET_DECRYPTION_FAILED', (done) => {
    // 1. Ensure Spy
    if (!jasmine.isSpy(firestore.onSnapshot)) {
      spyOn(firestore as any, 'onSnapshot');
    }

    // Capture callback
    let snapshotCallback: any;
    (firestore.onSnapshot as jasmine.Spy).and.callFake((query, cb) => {
      snapshotCallback = cb;
      return () => { }; // unsubscribe
    });

    // 2. Subscribe
    service.getMessages('chat_fail').subscribe();

    // 3. Mock Crypto Failure
    cryptoSpy.decryptWithRatchet.and.returnValue(Promise.resolve('ERROR_RATCHET_DECRYPTION_FAILED'));
    localStorage.setItem('private_key', 'pk');

    // 4. Trigger Callback with Failed Message
    const mockSnapshot = {
      docs: [
        {
          id: 'msg_fail',
          data: () => ({
            senderId: 'other_id',
            content_self: '',
            content: { 'my_id': 'encrypted_fail' },
            timestamp: Date.now()
          })
        }
      ]
    };

    // Need to wait for async processing inside callback
    setTimeout(async () => {
      await snapshotCallback(mockSnapshot);

      // 5. Verify Retry Signal Sent (addDoc)
      expect(firestore.addDoc).toHaveBeenCalled();
      const addArgs = (firestore.addDoc as jasmine.Spy).calls.mostRecent().args[1];
      expect(addArgs.type).toBe('system_signal');
      expect(addArgs.content).toBe('retry_session');
      expect(addArgs.targetId).toBe('other_id');
      done();
    }, 100);
  });

  it('should clear session when receiving retry_session signal', (done) => {
    // 1. Ensure Spy
    if (!jasmine.isSpy(firestore.onSnapshot)) {
      spyOn(firestore as any, 'onSnapshot');
    }

    let snapshotCallback: any;
    (firestore.onSnapshot as jasmine.Spy).and.callFake((query, cb) => {
      snapshotCallback = cb;
      return () => { };
    });

    service.getMessages('chat_signal').subscribe();

    // 2. Trigger Signal Message
    const mockSnapshot = {
      docs: [
        {
          id: 'signal_msg',
          data: () => ({
            senderId: 'requester_id',
            targetId: 'my_id',
            type: 'system_signal',
            content: 'retry_session',
            timestamp: Date.now()
          })
        }
      ]
    };

    // 3. Exec
    setTimeout(async () => {
      await snapshotCallback(mockSnapshot);

      // 4. Verify Clear Session
      expect(cryptoSpy.clearSession).toHaveBeenCalledWith('requester_id');
      done();
    }, 50);
  });

});
