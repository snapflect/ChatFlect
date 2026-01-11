import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsPage } from './contacts.page';
import { IonicModule, ToastController, AlertController, NavController } from '@ionic/angular';
import { ContactsService } from 'src/app/services/contacts.service';
import { ChatService } from 'src/app/services/chat.service';
import { Router } from '@angular/router';
import { LoggingService } from 'src/app/services/logging.service';
import { of } from 'rxjs';

describe('ContactsPage', () => {
  let component: ContactsPage;
  let fixture: ComponentFixture<ContactsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ContactsPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: ContactsService, useValue: jasmine.createSpyObj('ContactsService', ['getAllContacts', 'syncPhone', 'saveManualContact']) },
        { provide: ChatService, useValue: jasmine.createSpyObj('ChatService', ['getOrCreateChat']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
        { provide: LoggingService, useValue: jasmine.createSpyObj('LoggingService', ['log', 'error']) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['navigateForward']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
