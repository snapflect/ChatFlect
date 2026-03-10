
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PickContactModalComponent } from './pick-contact-modal.component';
import { IonicModule, ModalController } from '@ionic/angular';
import { ContactResolverService } from 'src/app/services/contact-resolver.service';
import { of } from 'rxjs';

describe('PickContactModalComponent', () => {
    let component: PickContactModalComponent;
    let fixture: ComponentFixture<PickContactModalComponent>;
    let contactsServiceSpy: jasmine.SpyObj<ContactResolverService>;
    let modalCtrlSpy: jasmine.SpyObj<ModalController>;

    beforeEach(async () => {
        contactsServiceSpy = jasmine.createSpyObj('ContactResolverService', ['getAllResolvedContactsAsArray']);
        contactsServiceSpy.getAllResolvedContactsAsArray.and.returnValue(Promise.resolve([
            { user_id: '1', display_name: 'Alice Doe', hash: 'h1', phone_last4: '1234', phone_e164: null, status: 'on_chatflect', photo_url: null, server_name: null, short_note: null },
            { user_id: '2', display_name: 'Bob Smith', hash: 'h2', phone_last4: '5678', phone_e164: null, status: 'on_chatflect', photo_url: null, server_name: null, short_note: null }
        ]));

        modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);

        await TestBed.configureTestingModule({
            declarations: [PickContactModalComponent],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: ContactResolverService, useValue: contactsServiceSpy },
                { provide: ModalController, useValue: modalCtrlSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PickContactModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load contacts on init but exclude existing members', async () => {
        component.excludeIds = ['1'];
        await component.loadContacts();
        expect(component.contacts.length).toBe(1);
        expect(component.contacts[0].user_id).toBe('2');
    });

    it('should toggle selection correctly', () => {
        component.toggleSelection('2');
        expect(component.selectedIds).toContain('2');
        component.toggleSelection('2');
        expect(component.selectedIds).not.toContain('2');
    });
});
