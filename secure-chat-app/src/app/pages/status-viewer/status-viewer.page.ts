import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-status-viewer',
  templateUrl: './status-viewer.page.html',
  styleUrls: ['./status-viewer.page.scss'],
  standalone: false
})
export class StatusViewerPage implements OnInit, OnDestroy {
  @Input() userStatuses: any[] = [];
  currentIndex: number = 0;
  progress: number = 0;
  interval: any;
  duration: number = 5000; // 5 seconds per slide
  step: number = 50; // Update every 50ms

  isPaused = false;

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {
    this.startTimer();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  startTimer() {
    this.stopTimer();
    this.isPaused = false;

    this.interval = setInterval(() => {
      if (!this.isPaused) {
        this.progress += (this.step / this.duration);
        if (this.progress >= 1) {
          this.next();
        }
      }
    }, this.step);
  }

  stopTimer() {
    if (this.interval) clearInterval(this.interval);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  next() {
    if (this.currentIndex < this.userStatuses.length - 1) {
      this.currentIndex++;
      this.progress = 0; // Reset progress for next slide
    } else {
      this.close();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.progress = 0;
    }
  }

  close() {
    this.stopTimer();
    this.modalCtrl.dismiss();
  }
}
