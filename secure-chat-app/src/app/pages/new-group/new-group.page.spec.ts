import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewGroupPage } from './new-group.page';
import { IonicModule, NavController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { ChatService } from 'src/app/services/chat.service';
import { LoggingService } from 'src/app/services/logging.service';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

describe('NewGroupPage', () => {
  let component: NewGroupPage;
  let fixture: ComponentFixture<NewGroupPage>;

  beforeEach(async () => {
    const apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post']);
    apiSpy.get.and.returnValue(of([]));

    const chatSpy = jasmine.createSpyObj('ChatService', ['createGroup']);
    chatSpy.createGroup.and.returnValue(Promise.resolve('group_123'));

    const loggerSpy = jasmine.createSpyObj('LoggingService', ['log', 'error']);

    await TestBed.configureTestingModule({
      declarations: [NewGroupPage],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: ChatService, useValue: chatSpy },
        { provide: LoggingService, useValue: loggerSpy },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['back', 'navigateBack']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NewGroupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
