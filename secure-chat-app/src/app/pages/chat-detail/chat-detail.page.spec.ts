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
        { provide: AuthService, useValue: { currentUserId: of('my_id'), isUserBlocked: () => Promise.resolve(false) } },
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

  it('should send a message and clear input', fakeAsync(() => {
    component.newMessage = 'Test message';
    chatServiceSpy.sendMessage.and.returnValue(Promise.resolve());

    component.sendMessage();
    tick();

    expect(chatServiceSpy.sendMessage).toHaveBeenCalledWith('chat_123', 'Test message', 'my_id', null);
    expect(component.newMessage).toBe('');
  }));
});
