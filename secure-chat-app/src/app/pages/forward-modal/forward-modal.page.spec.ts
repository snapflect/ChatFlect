import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForwardModalPage } from './forward-modal.page';
import { IonicModule, ModalController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { of } from 'rxjs';

describe('ForwardModalPage', () => {
    let component: ForwardModalPage;
    let fixture: ComponentFixture<ForwardModalPage>;
    let chatServiceSpy: jasmine.SpyObj<ChatService>;
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let modalCtrlSpy: jasmine.SpyObj<ModalController>;

    beforeEach(async () => {
        chatServiceSpy = jasmine.createSpyObj('ChatService', ['getChats']);
        authServiceSpy = jasmine.createSpyObj('AuthService', [], { currentUserId: of('my_id') });
        modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);

        chatServiceSpy.getChats.and.returnValue(of([]));

        await TestBed.configureTestingModule({
            declarations: [ForwardModalPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: ChatService, useValue: chatServiceSpy },
                { provide: AuthService, useValue: authServiceSpy },
                { provide: ModalController, useValue: modalCtrlSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ForwardModalPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load chats on init', () => {
        expect(chatServiceSpy.getChats).toHaveBeenCalledWith('my_id');
    });

    it('should dismiss with selected chat details', () => {
        const mockChat = { id: 'c1', isGroup: true, groupName: 'Test Group' };
        component.selectChat(mockChat);
        expect(modalCtrlSpy.dismiss).toHaveBeenCalledWith({
            selectedChatId: 'c1',
            selectedChatName: 'Test Group'
        });
    });

    it('should close on close()', () => {
        component.close();
        expect(modalCtrlSpy.dismiss).toHaveBeenCalled();
    });
});
