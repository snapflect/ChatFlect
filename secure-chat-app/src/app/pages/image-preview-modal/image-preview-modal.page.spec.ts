import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImagePreviewModalPage } from './image-preview-modal.page';
import { IonicModule, ModalController, NavParams } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

describe('ImagePreviewModalPage', () => {
  let component: ImagePreviewModalPage;
  let fixture: ComponentFixture<ImagePreviewModalPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImagePreviewModalPage],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: [
        { provide: ModalController, useValue: jasmine.createSpyObj('ModalController', ['dismiss']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ImagePreviewModalPage);
    component = fixture.componentInstance;
    component.imageFile = new Blob();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
