
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PickContactModalComponent } from './pick-contact-modal.component';
import { IonicModule, ModalController } from '@ionic/angular';
import { ContactsService } from 'src/app/services/contacts.service';
import { of } from 'rxjs';

describe('PickContactModalComponent', () => {
    let component: PickContactModalComponent;
    let fixture: ComponentFixture<PickContactModalComponent>;
    let contactsServiceSpy: jasmine.SpyObj<ContactsService>;
    let modalCtrlSpy: jasmine.SpyObj<ModalController>;

    beforeEach(async () => {
        contactsServiceSpy = jasmine.createSpyObj('ContactsService', ['getContacts']);
        contactsServiceSpy.getContacts.and.returnValue(Promise.resolve([
            { user_id: '1', first_name: 'Alice', last_name: 'Doe' },
            { user_id: '2', first_name: 'Bob', last_name: 'Smith' }
        ]));

        modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);

        await TestBed.configureTestingModule({
            declarations: [PickContactModalComponent],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: ContactsService, useValue: contactsServiceSpy },
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
