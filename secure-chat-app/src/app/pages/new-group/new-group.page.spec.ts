import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewGroupPage } from './new-group.page';
import { IonicModule, NavController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { ChatService } from 'src/app/services/chat.service';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

describe('NewGroupPage', () => {
  let component: NewGroupPage;
  let fixture: ComponentFixture<NewGroupPage>;

  beforeEach(async () => {
    const apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post']);
    apiSpy.get.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [NewGroupPage],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        { provide: ChatService, useValue: jasmine.createSpyObj('ChatService', ['createGroup']) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['back']) }
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
