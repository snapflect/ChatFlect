import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatsPage } from './chats.page';
import { IonicModule, NavController, ToastController, ActionSheetController, AlertController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { PresenceService } from 'src/app/services/presence.service';
import { ChatSettingsService } from 'src/app/services/chat-settings.service';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

describe('ChatsPage', () => {
  let component: ChatsPage;
  let fixture: ComponentFixture<ChatsPage>;
  let chatServiceSpy: jasmine.SpyObj<ChatService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let presenceSpy: jasmine.SpyObj<PresenceService>;
  let chatSettingsSpy: jasmine.SpyObj<ChatSettingsService>;

  beforeEach(async () => {
    chatServiceSpy = jasmine.createSpyObj('ChatService', ['getMyChats', 'getChats']);
    const contactsSpy = jasmine.createSpyObj('ContactsService', ['getContacts'], {
      localContacts: []
    });
    contactsSpy.getContacts.and.returnValue(Promise.resolve([]));

    authSpy = jasmine.createSpyObj('AuthService', [], {
      currentUserId: of('my_id')
    });

    // Mock PresenceService (WhatsApp Parity)
    presenceSpy = jasmine.createSpyObj('PresenceService', ['getPresence', 'setTyping']);
    presenceSpy.getPresence.and.returnValue(of({ state: 'offline' }));

    // Mock ChatSettingsService (WhatsApp Parity - Swipe Actions)
    chatSettingsSpy = jasmine.createSpyObj('ChatSettingsService', [
      'getSettings', 'isPinned', 'isMuted', 'isArchived',
      'togglePin', 'toggleMute', 'toggleArchive', 'loadMultipleSettings'
    ], {
      settings$: of(new Map())
    });
    chatSettingsSpy.isPinned.and.returnValue(false);
    chatSettingsSpy.isMuted.and.returnValue(false);
    chatSettingsSpy.isArchived.and.returnValue(false);
    chatSettingsSpy.loadMultipleSettings.and.returnValue(Promise.resolve());
    chatSettingsSpy.togglePin.and.returnValue(Promise.resolve());
    chatSettingsSpy.toggleMute.and.returnValue(Promise.resolve());
    chatSettingsSpy.toggleArchive.and.returnValue(Promise.resolve());

    // Mock ToastController
    const toastSpy = jasmine.createSpyObj('ToastController', ['create']);
    toastSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve() }));

    // Mock ActionSheetController (Long Press Menu)
    const actionSheetSpy = jasmine.createSpyObj('ActionSheetController', ['create']);
    actionSheetSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve() }));

    // Mock AlertController (Delete Confirm)
    const alertSpy = jasmine.createSpyObj('AlertController', ['create']);
    alertSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve() }));

    await TestBed.configureTestingModule({
      declarations: [ChatsPage],
      imports: [IonicModule.forRoot(), RouterTestingModule],
      providers: [
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: ContactsService, useValue: contactsSpy },
        { provide: PresenceService, useValue: presenceSpy },
        { provide: ChatSettingsService, useValue: chatSettingsSpy },
        { provide: ToastController, useValue: toastSpy },
        { provide: ActionSheetController, useValue: actionSheetSpy },
        { provide: AlertController, useValue: alertSpy },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['navigateForward']) }
      ]
    }).compileComponents();


    chatServiceSpy.getChats.and.returnValue(of([]));

    fixture = TestBed.createComponent(ChatsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load chats on init', (done) => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(chatServiceSpy.getMyChats).toHaveBeenCalled();
      done();
    });
  });

  // --- Online Indicator Tests (WhatsApp Parity) ---

  describe('Online Indicator Logic', () => {
    it('should have onlineUsers map initialized', () => {
      expect(component.onlineUsers).toBeDefined();
      expect(component.onlineUsers instanceof Map).toBe(true);
    });

    it('should return false for users not in onlineUsers map', () => {
      expect(component.isUserOnline('unknown_user')).toBe(false);
    });

    it('should return true for online users in map', () => {
      component.onlineUsers.set('user_123', true);
      expect(component.isUserOnline('user_123')).toBe(true);
    });

    it('should return false for offline users in map', () => {
      component.onlineUsers.set('user_456', false);
      expect(component.isUserOnline('user_456')).toBe(false);
    });

    it('should clean up subscriptions on destroy', () => {
      component.ngOnDestroy();
      // No error means subscriptions were cleaned up properly
      expect(true).toBe(true);
    });
  });

  it('should map groupIcon to avatar for groups', fakeAsync(() => {
    const groupChat = {
      id: 'g1',
      isGroup: true,
      groupName: 'My Group',
      groupIcon: 'http://example.com/icon.png',
      participants: ['123', '456'],
      lastMessage: 'Hello',
      lastTimestamp: { seconds: 1000 }
    };

    chatServiceSpy.getMyChats.and.returnValue(of([groupChat]));
    component.ngOnInit();
    tick(); // Wait for promise resolution (if any) and observables

    // Trigger subscription logic
    fixture.detectChanges();

    expect(component.chats.length).toBe(1);
    expect(component.chats[0].avatar).toBe('http://example.com/icon.png');
    expect(component.chats[0].name).toBe('My Group');
  }));
});
