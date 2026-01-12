import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { StarredMessagesPage } from './starred-messages.page';
import { ChatService } from 'src/app/services/chat.service';
import { of } from 'rxjs';

describe('StarredMessagesPage', () => {
    let component: StarredMessagesPage;
    let fixture: ComponentFixture<StarredMessagesPage>;
    let chatServiceSpy: jasmine.SpyObj<ChatService>;
    let navCtrlSpy: jasmine.SpyObj<NavController>;

    beforeEach(waitForAsync(() => {
        const chatSpy = jasmine.createSpyObj('ChatService', ['getStarredMessages', 'toggleStarMessage']);
        const navSpy = jasmine.createSpyObj('NavController', ['navigateForward', 'back']);
        const toastSpy = jasmine.createSpyObj('ToastController', ['create']);
        const alertSpy = jasmine.createSpyObj('AlertController', ['create']);

        chatSpy.getStarredMessages.and.returnValue(of([
            { id: '1', text: 'Hello', starredBy: ['me'], timestamp: Date.now() }
        ]));

        TestBed.configureTestingModule({
            declarations: [StarredMessagesPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: ChatService, useValue: chatSpy },
                { provide: NavController, useValue: navSpy },
                { provide: ToastController, useValue: toastSpy },
                { provide: AlertController, useValue: alertSpy }
            ]
        }).compileComponents();

        chatServiceSpy = TestBed.inject(ChatService) as jasmine.SpyObj<ChatService>;
        navCtrlSpy = TestBed.inject(NavController) as jasmine.SpyObj<NavController>;

        fixture = TestBed.createComponent(StarredMessagesPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load starred messages on init', () => {
        expect(chatServiceSpy.getStarredMessages).toHaveBeenCalled();
        expect(component.starredMessages.length).toBe(1);
    });

    it('should call toggleStarMessage when unstarring', () => {
        const msg = { id: '1', chatId: 'c1', text: 'test' };
        component.unstar(msg);
        expect(chatServiceSpy.toggleStarMessage).toHaveBeenCalledWith('c1', '1', false);
    });
});
