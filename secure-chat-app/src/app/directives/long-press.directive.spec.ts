import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LongPressDirective } from './long-press.directive';
import { IonicModule } from '@ionic/angular';
import { By } from '@angular/platform-browser';

@Component({
    template: `<div (longPress)="onLongPress()">Test Item</div>`,
    standalone: false
})
class TestComponent {
    onLongPress() { }
}

describe('LongPressDirective', () => {
    let fixture: ComponentFixture<TestComponent>;
    let component: TestComponent;
    let element: DebugElement;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [LongPressDirective, TestComponent],
            imports: [IonicModule.forRoot()]
        }).compileComponents();

        fixture = TestBed.createComponent(TestComponent);
        component = fixture.componentInstance;
        element = fixture.debugElement.query(By.directive(LongPressDirective));
        fixture.detectChanges();
    });

    it('should create an instance', () => {
        const directive = element.injector.get(LongPressDirective);
        expect(directive).toBeTruthy();
    });

    // Use a helper to dispatch events since TouchEvent constructor is tricky in Headless Chrome
    function dispatchFakeEvent(type: string, x: number, y: number) {
        const event = new CustomEvent(type) as any;
        event.touches = [{ clientX: x, clientY: y }];
        element.nativeElement.dispatchEvent(event);
    }

    it('should emit longPress after 500ms on touchstart', fakeAsync(() => {
        spyOn(component, 'onLongPress');

        dispatchFakeEvent('touchstart', 100, 100);

        tick(499);
        expect(component.onLongPress).not.toHaveBeenCalled();

        tick(1);
        expect(component.onLongPress).toHaveBeenCalled();
    }));

    it('should cancel on movement beyond threshold', fakeAsync(() => {
        spyOn(component, 'onLongPress');

        dispatchFakeEvent('touchstart', 100, 100);
        tick(250);

        dispatchFakeEvent('touchmove', 150, 150);
        tick(250);

        expect(component.onLongPress).not.toHaveBeenCalled();
    }));

    it('should cancel on touchend', fakeAsync(() => {
        spyOn(component, 'onLongPress');

        dispatchFakeEvent('touchstart', 100, 100);
        tick(250);

        element.nativeElement.dispatchEvent(new Event('touchend'));
        tick(250);

        expect(component.onLongPress).not.toHaveBeenCalled();
    }));

    it('should work with mousedown', fakeAsync(() => {
        spyOn(component, 'onLongPress');

        element.nativeElement.dispatchEvent(new MouseEvent('mousedown'));
        tick(500);

        expect(component.onLongPress).toHaveBeenCalled();
    }));
});
