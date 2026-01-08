import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusViewerPage } from './status-viewer.page';

describe('StatusViewerPage', () => {
  let component: StatusViewerPage;
  let fixture: ComponentFixture<StatusViewerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(StatusViewerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
