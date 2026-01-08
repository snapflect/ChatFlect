import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImagePreviewModalPage } from './image-preview-modal.page';

describe('ImagePreviewModalPage', () => {
  let component: ImagePreviewModalPage;
  let fixture: ComponentFixture<ImagePreviewModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ImagePreviewModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
