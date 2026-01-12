import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { ArchivedChatsPage } from './archived-chats.page';
import { ChatService } from 'src/app/services/chat.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { PresenceService } from 'src/app/services/presence.service';
import { ChatSettingsService } from 'src/app/services/chat-settings.service';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ArchivedChatsPage', () => {
    let component: ArchivedChatsPage;
    let fixture: ComponentFixture<ArchivedChatsPage>;

    const chatServiceSpy = jasmine.createSpyObj('ChatService', ['getMyChats', 'getUserInfo']);
    const contactsServiceSpy = jasmine.createSpyObj('ContactsService', ['getContacts']);
    const presenceServiceSpy = jasmine.createSpyObj('PresenceService', ['getPresence']);
    const chatSettingsSpy = jasmine.createSpyObj('ChatSettingsService', ['loadMultipleSettings', 'isArchived', 'toggleArchive'], {
        settings$: of(new Map())
    });
    const toastSpy = jasmine.createSpyObj('ToastController', ['create']);
    const navSpy = jasmine.createSpyObj('NavController', ['back']);

    beforeEach(fakeAsync(() => {
        TestBed.configureTestingModule({
            declarations: [ArchivedChatsPage],
            imports: [RouterTestingModule],
            providers: [
                { provide: ChatService, useValue: chatServiceSpy },
                { provide: ContactsService, useValue: contactsServiceSpy },
                { provide: PresenceService, useValue: presenceServiceSpy },
                { provide: ChatSettingsService, useValue: chatSettingsSpy },
                { provide: ToastController, useValue: toastSpy },
                { provide: NavController, useValue: navSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(ArchivedChatsPage);
        component = fixture.componentInstance;

        chatServiceSpy.getMyChats.and.returnValue(of([]));
        chatServiceSpy.getUserInfo.and.returnValue(Promise.resolve({ username: 'testuser', photo: '' }));
        contactsServiceSpy.getContacts.and.returnValue(Promise.resolve());
        contactsServiceSpy.localContacts = [];
        chatSettingsSpy.loadMultipleSettings.and.returnValue(Promise.resolve());
        presenceServiceSpy.getPresence.and.returnValue(of({ state: 'online' }));
    }));

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load archived chats on init', async () => {
        const mockChats = [
            { id: '1', lastMessage: 'hello', participants: ['user1', 'user2'] },
            { id: '2', lastMessage: 'bye', participants: ['user1', 'user2'] }
        ];
        chatServiceSpy.getMyChats.and.returnValue(of(mockChats));
        chatSettingsSpy.isArchived.and.callFake((id: string) => id === '1');

        await component.loadArchivedChats();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.archivedChats.length).toBe(1);
        expect(component.archivedChats[0].id).toBe('1');
    });

    it('should call unarchive and remove from list', async () => {
        const slidingItemSpy = jasmine.createSpyObj('IonItemSliding', ['close']);
        component.archivedChats = [{ id: 'archived1' }];
        chatSettingsSpy.toggleArchive.and.returnValue(Promise.resolve());
        toastSpy.create.and.returnValue(Promise.resolve({ present: () => { } }));

        await component.unarchiveChat('archived1', slidingItemSpy);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(chatSettingsSpy.toggleArchive).toHaveBeenCalledWith('archived1');
        expect(component.archivedChats.length).toBe(0);
        expect(slidingItemSpy.close).toHaveBeenCalled();
    });
});
