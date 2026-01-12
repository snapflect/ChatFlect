import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupInfoPage } from './group-info.page';
import { IonicModule, NavController, ActionSheetController, AlertController, ToastController, ModalController } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { initializeApp } from 'firebase/app';

describe('GroupInfoPage', () => {
  let component: GroupInfoPage;
  let fixture: ComponentFixture<GroupInfoPage>;

  beforeEach(async () => {
    try { initializeApp({ apiKey: "fake", projectId: "test" }); } catch (e) { }

    await TestBed.configureTestingModule({
      declarations: [GroupInfoPage],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: ChatService, useValue: jasmine.createSpyObj('ChatService', ['getChatDetails', 'getOrCreateChat']) },
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', [], { currentUserId: of('123') }) },
        { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['get', 'post']) },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['back', 'navigateForward']) },
        { provide: ActionSheetController, useValue: jasmine.createSpyObj('ActionSheetController', ['create']) },
        { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', ['create']) },
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['create']) },
        { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', ['create']) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'group_123' } } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GroupInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
