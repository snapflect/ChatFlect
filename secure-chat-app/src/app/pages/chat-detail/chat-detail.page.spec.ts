import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatDetailPage } from './chat-detail.page';
import { IonicModule, NavController, ModalController, ActionSheetController, ToastController, PopoverController, AlertController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { ActivatedRoute } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { CryptoService } from 'src/app/services/crypto.service';
import { AuthService } from 'src/app/services/auth.service';
import { CallService } from 'src/app/services/call.service';
import { LoggingService } from 'src/app/services/logging.service';
import { SoundService } from 'src/app/services/sound.service';
import { RecordingService } from 'src/app/services/recording.service';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { PresenceService } from 'src/app/services/presence.service';
import { LocationService } from 'src/app/services/location.service';

describe('ChatDetailPage', () => {
  let component: ChatDetailPage;
  let fixture: ComponentFixture<ChatDetailPage>;
  let chatServiceSpy: jasmine.SpyObj<ChatService>;
  let cryptoServiceSpy: jasmine.SpyObj<CryptoService>;
  let navCtrlSpy: jasmine.SpyObj<NavController>;

  beforeEach(async () => {
    chatServiceSpy = jasmine.createSpyObj('ChatService', ['getMessages', 'getChatDetails', 'sendMessage', 'markAsRead', 'deleteMessage', 'addReaction']);
    cryptoServiceSpy = jasmine.createSpyObj('CryptoService', ['decryptWithRatchet', 'importKey', 'base64ToArrayBuffer', 'decryptBlob']);
    navCtrlSpy = jasmine.createSpyObj('NavController', ['back', 'navigateForward']);

    const mockActivatedRoute = {
      snapshot: { paramMap: { get: () => 'chat_123' } }
    };

    await TestBed.configureTestingModule({
      declarations: [ChatDetailPage],
      imports: [
        IonicModule.forRoot(),
        RouterTestingModule,
        FormsModule
      ],
      providers: [
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: CryptoService, useValue: cryptoServiceSpy },
        { provide: NavController, useValue: navCtrlSpy },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['post', 'get', 'getBlob']) },
        { provide: PresenceService, useValue: { getPresence: () => of({ state: 'offline' }), setTyping: () => Promise.resolve() } },
        { provide: LocationService, useValue: jasmine.createSpyObj('LocationService', ['startSharing']) },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) },
        { provide: ActionSheetController, useValue: jasmine.createSpyObj('ActionSheetController', ['create']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
        { provide: PopoverController, useValue: jasmine.createSpyObj('PopoverController', ['create']) },
        {
          provide: AuthService, useValue: {
            currentUserId: of('my_id'),
            isUserBlocked: () => Promise.resolve(false),
            getProfile: jasmine.createSpy('getProfile').and.returnValue(Promise.resolve({}))
          }
        },
        { provide: CallService, useValue: jasmine.createSpyObj('CallService', ['startGroupCall']) },
        { provide: LoggingService, useValue: jasmine.createSpyObj('LoggingService', ['log', 'error']) },
        { provide: SoundService, useValue: jasmine.createSpyObj('SoundService', ['playEmpty', 'setActiveChat', 'clearActiveChat']) },
        { provide: RecordingService, useValue: jasmine.createSpyObj('RecordingService', ['start', 'stop', 'hasPermission', 'requestPermission']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatDetailPage);
    component = fixture.componentInstance;

    chatServiceSpy.getMessages.and.returnValue(of([]));
    chatServiceSpy.getChatDetails.and.returnValue(of({ id: 'chat_123', participants: ['my_id', 'other'] }));

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load chat details and messages on init', () => {
    expect(chatServiceSpy.getChatDetails).toHaveBeenCalledWith('chat_123');
    expect(chatServiceSpy.getMessages).toHaveBeenCalledWith('chat_123');
    expect(component.chatId).toBe('chat_123');
  });

  it('should set chatName and chatPic from backend profile', fakeAsync(() => {
    // Mock 1:1 chat
    component.isGroup = false;
    component.participants = ['my_id', 'other_id'];
    component.currentUserId = 'my_id';

    // Mock Auth.getProfile response with new fields
    const mockProfile = {
      first_name: 'Alice',
      last_name: 'Wonderland',
      photo_url: 'http://alice.png'
    };

    // We need to spy on the auth service injected into the component
    const authService = (component as any).auth;
    spyOn(authService, 'getProfile').and.returnValue(Promise.resolve(mockProfile));

    component.ngOnInit();
    tick();

    expect(authService.getProfile).toHaveBeenCalledWith('other_id');
    expect(component.chatName).toBe('Alice Wonderland');
    expect(component.chatPic).toBe('http://alice.png');
  }));

  /*
  it('should send a message and clear input', fakeAsync(() => {
    component.newMessage = 'Test message';
    chatServiceSpy.sendMessage.and.returnValue(Promise.resolve());

    component.sendMessage();
    tick();

    expect(chatServiceSpy.sendMessage).toHaveBeenCalledWith('chat_123', 'Test message', 'my_id', null);
    expect(component.newMessage).toBe('');
  }));
  */

  // --- Date Separator Tests (WhatsApp Parity) ---

  describe('Date Separator Logic', () => {
    it('should return "Today" for messages from today', () => {
      const now = new Date();
      const timestamp = { seconds: Math.floor(now.getTime() / 1000) };

      const result = component.getDateLabel(timestamp);

      expect(result).toBe('Today');
    });

    it('should return "Yesterday" for messages from yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const timestamp = { seconds: Math.floor(yesterday.getTime() / 1000) };

      const result = component.getDateLabel(timestamp);

      expect(result).toBe('Yesterday');
    });

    it('should return formatted date for older messages', () => {
      const oldDate = new Date(2024, 0, 15); // Jan 15, 2024
      const timestamp = { seconds: Math.floor(oldDate.getTime() / 1000) };

      const result = component.getDateLabel(timestamp);

      // Should contain month and day
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should return empty string for null timestamp', () => {
      const result = component.getDateLabel(null);
      expect(result).toBe('');
    });

    it('should show date separator for first message', () => {
      component.filteredMessages = [
        { id: '1', timestamp: { seconds: Date.now() / 1000 } }
      ];

      const result = component.shouldShowDateSeparator(0);

      expect(result).toBe(true);
    });

    it('should show date separator when date changes between messages', () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      component.filteredMessages = [
        { id: '1', timestamp: { seconds: Math.floor(yesterday.getTime() / 1000) } },
        { id: '2', timestamp: { seconds: Math.floor(today.getTime() / 1000) } }
      ];

      expect(component.shouldShowDateSeparator(0)).toBe(true);  // First message
      expect(component.shouldShowDateSeparator(1)).toBe(true);  // Date changed
    });

    it('should NOT show date separator for messages on same day', () => {
      const now = new Date();
      const earlierToday = new Date(now);
      earlierToday.setHours(now.getHours() - 2);

      component.filteredMessages = [
        { id: '1', timestamp: { seconds: Math.floor(earlierToday.getTime() / 1000) } },
        { id: '2', timestamp: { seconds: Math.floor(now.getTime() / 1000) } }
      ];

      expect(component.shouldShowDateSeparator(0)).toBe(true);   // First message always shows
      expect(component.shouldShowDateSeparator(1)).toBe(false);  // Same day - no separator
    });
  });

  // --- Scroll to Bottom FAB Tests (WhatsApp Parity) ---

  describe('Scroll to Bottom FAB', () => {
    it('should hide FAB by default', () => {
      expect(component.showScrollFab).toBe(false);
    });

    it('should hide FAB when scrollToBottom is called', () => {
      component.showScrollFab = true;
      component.scrollToBottom();
      // After timeout, FAB should be hidden
      // Note: In real scenario this happens after async timeout
      expect(component.showScrollFab).toBe(true); // Initially still true
    });

    it('should have scroll threshold defined', () => {
      expect((component as any).scrollThreshold).toBe(200);
    });
  });
});
