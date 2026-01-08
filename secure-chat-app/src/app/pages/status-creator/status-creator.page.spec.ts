import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusCreatorPage } from './status-creator.page';

describe('StatusCreatorPage', () => {
  let component: StatusCreatorPage;
  let fixture: ComponentFixture<StatusCreatorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(StatusCreatorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
