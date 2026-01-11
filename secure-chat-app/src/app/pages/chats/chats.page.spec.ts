import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatsPage } from './chats.page';
import { IonicModule, NavController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

describe('ChatsPage', () => {
  let component: ChatsPage;
  let fixture: ComponentFixture<ChatsPage>;
  let chatServiceSpy: jasmine.SpyObj<ChatService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    chatServiceSpy = jasmine.createSpyObj('ChatService', ['getMyChats', 'getChats']);
    const contactsSpy = jasmine.createSpyObj('ContactsService', ['getContacts'], {
      localContacts: []
    });
    contactsSpy.getContacts.and.returnValue(Promise.resolve([]));

    authSpy = jasmine.createSpyObj('AuthService', [], {
      currentUserId: of('my_id')
    });

    await TestBed.configureTestingModule({
      declarations: [ChatsPage],
      imports: [IonicModule.forRoot(), RouterTestingModule],
      providers: [
        { provide: ChatService, useValue: chatServiceSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: ContactsService, useValue: contactsSpy },
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

  it('should load chats on init', () => {
    expect(chatServiceSpy.getMyChats).toHaveBeenCalled();
  });
});
