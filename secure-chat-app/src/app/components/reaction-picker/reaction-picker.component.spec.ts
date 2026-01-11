import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactionPickerComponent } from './reaction-picker.component';
import { IonicModule, PopoverController } from '@ionic/angular';

describe('ReactionPickerComponent', () => {
    let component: ReactionPickerComponent;
    let fixture: ComponentFixture<ReactionPickerComponent>;
    let popoverCtrlSpy: jasmine.SpyObj<PopoverController>;

    beforeEach(async () => {
        popoverCtrlSpy = jasmine.createSpyObj('PopoverController', ['dismiss']);

        await TestBed.configureTestingModule({
            declarations: [ReactionPickerComponent],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: PopoverController, useValue: popoverCtrlSpy }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ReactionPickerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should dismiss with selected emoji', () => {
        const emoji = '👍';
        component.select(emoji);
        expect(popoverCtrlSpy.dismiss).toHaveBeenCalledWith({ reaction: emoji });
    });
});
