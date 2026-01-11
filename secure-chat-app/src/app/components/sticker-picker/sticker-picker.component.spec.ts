import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { StickerPickerComponent } from './sticker-picker.component';
import { StickerService } from 'src/app/services/sticker.service';
import { of } from 'rxjs';
import { IonicModule } from '@ionic/angular';

describe('StickerPickerComponent', () => {
  let component: StickerPickerComponent;
  let fixture: ComponentFixture<StickerPickerComponent>;
  let stickerServiceSpy: jasmine.SpyObj<StickerService>;

  beforeEach(async () => {
    stickerServiceSpy = jasmine.createSpyObj('StickerService', ['getTrending', 'search']);
    stickerServiceSpy.getTrending.and.returnValue(of([]));
    stickerServiceSpy.search.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [StickerPickerComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: StickerService, useValue: stickerServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StickerPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load trending stickers on init', () => {
    expect(stickerServiceSpy.getTrending).toHaveBeenCalled();
  });

  it('should search stickers on input with debounce', fakeAsync(() => {
    component.onSearch({ target: { value: 'cat' } });
    tick(300);
    expect(stickerServiceSpy.search).toHaveBeenCalledWith('cat');
  }));

  it('should emit selected sticker', () => {
    spyOn(component.stickerSelected, 'emit');
    component.selectSticker('http://image.png');
    expect(component.stickerSelected.emit).toHaveBeenCalledWith('http://image.png');
  });
});
