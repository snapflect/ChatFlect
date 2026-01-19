import { Component, OnDestroy } from '@angular/core';
import { StatusService } from 'src/app/services/status.service';
import { VoiceRecorderService, RecordingState } from 'src/app/services/voice-recorder.service';
import { Router } from '@angular/router';
import { ToastController, LoadingController, AlertController, ModalController } from '@ionic/angular';
import { DrawingEditorPage } from '../drawing-editor/drawing-editor.page';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-status-creator',
  templateUrl: './status-creator.page.html',
  styleUrls: ['./status-creator.page.scss'],
  standalone: false
})
export class StatusCreatorPage implements OnDestroy {
  mode: 'text' | 'media' | 'voice' | 'draw' = 'text';

  // Text Mode Data
  textContent = '';
  backgroundColor = '#EF5350'; // Red default
  selectedFont = 'sans-serif';
  colors = ['#EF5350', '#AB47BC', '#5C6BC0', '#26A69A', '#66BB6A', '#FFA726', '#8D6E63', '#455A64'];
  fonts = ['sans-serif', 'serif', 'monospace', 'cursive'];

  // Media Mode Data
  type: 'text' | 'image' | 'video' | 'audio' = 'text';
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  caption = '';

  // Voice Recording
  recordingState: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0
  };
  recordedAudioBlob: Blob | null = null;
  private recordingSub: Subscription | null = null;

  // Common
  privacy = 'everyone';

  constructor(
    private statusService: StatusService,
    private voiceRecorder: VoiceRecorderService,
    private router: Router,
    private toast: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) {
    this.recordingSub = this.voiceRecorder.state$.subscribe(state => {
      this.recordingState = state;
    });
  }

  ngOnDestroy() {
    this.recordingSub?.unsubscribe();
    this.voiceRecorder.cancelRecording();
  }

  onModeChange() {
    // Reset all when switching modes
    this.selectedFile = null;
    this.previewUrl = null;
    this.textContent = '';
    this.recordedAudioBlob = null;
    this.voiceRecorder.cancelRecording();
  }

  toggleFont() {
    const idx = this.fonts.indexOf(this.selectedFont);
    this.selectedFont = this.fonts[(idx + 1) % this.fonts.length];
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const mime = file.type;

      if (mime.startsWith('image')) {
        this.type = 'image';
        const reader = new FileReader();
        reader.onload = (e: any) => this.previewUrl = e.target.result;
        reader.readAsDataURL(file);
      } else if (mime.startsWith('video')) {
        this.type = 'video';
        this.previewUrl = URL.createObjectURL(file);
      } else if (mime.startsWith('audio')) {
        this.type = 'audio';
        this.previewUrl = null;
      }
    }
  }

  // ==================== VOICE RECORDING ====================

  async startVoiceRecording() {
    const started = await this.voiceRecorder.startRecording();
    if (!started) {
      const alert = await this.alertCtrl.create({
        header: 'Microphone Access',
        message: 'Please allow microphone access to record voice status.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  pauseVoiceRecording() {
    this.voiceRecorder.pauseRecording();
  }

  resumeVoiceRecording() {
    this.voiceRecorder.resumeRecording();
  }

  async stopVoiceRecording() {
    this.recordedAudioBlob = await this.voiceRecorder.stopRecording();
    if (this.recordedAudioBlob) {
      this.type = 'audio';
      this.selectedFile = new File([this.recordedAudioBlob], 'voice-status.webm', {
        type: this.recordedAudioBlob.type
      });
    }
  }

  cancelVoiceRecording() {
    this.voiceRecorder.cancelRecording();
    this.recordedAudioBlob = null;
  }

  deleteRecordedAudio() {
    this.recordedAudioBlob = null;
    this.selectedFile = null;
  }

  formatDuration(seconds: number): string {
    return this.voiceRecorder.formatDuration(seconds);
  }

  getMaxDuration(): number {
    return this.voiceRecorder.getMaxDuration();
  }

  // ==================== POST STATUS ====================

  async postStatus() {
    const loading = await this.loadingCtrl.create({ message: 'Posting...' });
    await loading.present();

    try {
      if (this.mode === 'text') {
        if (!this.textContent.trim()) {
          loading.dismiss();
          this.showToast('Please enter some text');
          return;
        }
        await this.statusService.uploadTextStatus(
          this.textContent,
          this.backgroundColor,
          this.selectedFont,
          this.privacy
        ).toPromise();
      } else if (this.mode === 'voice') {
        if (!this.selectedFile) {
          loading.dismiss();
          this.showToast('Please record a voice message first');
          return;
        }
        await this.statusService.uploadStatus(
          this.selectedFile,
          this.caption,
          'audio',
          this.privacy
        ).toPromise();
      } else {
        if (!this.selectedFile) {
          loading.dismiss();
          this.showToast('Please select a file');
          return;
        }

        await this.statusService.uploadStatus(
          this.selectedFile,
          this.caption,
          this.type as 'image' | 'video' | 'audio',
          this.privacy
        ).toPromise();
      }

      loading.dismiss();
      this.showToast('Status Posted!');
      this.router.navigate(['/tabs/status']);
    } catch (e) {
      console.error(e);
      loading.dismiss();
      this.showToast('Failed to post status');
    }
  }

  canPost(): boolean {
    if (this.mode === 'text') {
      return this.textContent.trim().length > 0;
    } else if (this.mode === 'voice') {
      return this.recordedAudioBlob !== null;
    } else if (this.mode === 'draw') {
      return false; // Drawing posts from the editor modal directly
    } else {
      return this.selectedFile !== null;
    }
  }

  async showToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 2000 });
    t.present();
  }

  // ==================== DRAWING EDITOR ====================

  async openDrawingEditor() {
    const modal = await this.modalCtrl.create({
      component: DrawingEditorPage,
      componentProps: {
        backgroundImage: this.previewUrl // Pass selected image as background if available
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.success) {
        this.router.navigate(['/tabs/status']);
      }
    });

    await modal.present();
  }
}
