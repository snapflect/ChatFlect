import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, NavController } from '@ionic/angular';
import { ContactInfoPage } from './contact-info.page';
import { ChatService } from 'src/app/services/chat.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ContactInfoPage', () => {
    let component: ContactInfoPage;
    let fixture: ComponentFixture<ContactInfoPage>;
    let chatServiceSpy: jasmine.SpyObj<ChatService>;

    beforeEach(waitForAsync(() => {
        const chatSpy = jasmine.createSpyObj('ChatService', ['getUserInfo', 'getSharedMedia']);
        const navSpy = jasmine.createSpyObj('NavController', ['back']);

        chatSpy.getUserInfo.and.returnValue(Promise.resolve({ username: 'Test User', photo: '' }));
        chatSpy.getSharedMedia.and.returnValue(of([]));

        TestBed.configureTestingModule({
            declarations: [ContactInfoPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: ChatService, useValue: chatSpy },
                { provide: NavController, useValue: navSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        queryParams: of({ userId: 'u1', chatId: 'c1' })
                    }
                }
            ]
        }).compileComponents();

        chatServiceSpy = TestBed.inject(ChatService) as jasmine.SpyObj<ChatService>;

        fixture = TestBed.createComponent(ContactInfoPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load user info and shared media on init', async () => {
        await fixture.whenStable(); // Wait for async loadUserInfo
        expect(chatServiceSpy.getUserInfo).toHaveBeenCalledWith('u1');
        expect(chatServiceSpy.getSharedMedia).toHaveBeenCalledWith('c1');
        expect(component.user).toEqual({ username: 'Test User', photo: '' });
    });
});
