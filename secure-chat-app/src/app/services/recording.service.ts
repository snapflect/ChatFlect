import { Injectable } from '@angular/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

@Injectable({
  providedIn: 'root'
})
export class RecordingService {

  constructor() { }

  async canRecord() {
    return VoiceRecorder.canDeviceVoiceRecord();
  }

  async hasPermission() {
    const status = await VoiceRecorder.hasAudioRecordingPermission();
    return status.value;
  }

  async requestPermission() {
    const status = await VoiceRecorder.requestAudioRecordingPermission();
    return status.value;
  }

  async startRecording() {
    return VoiceRecorder.startRecording();
  }

  async stopRecording() {
    // Returns { value: { recordDataBase64: string, msDuration: number, mimeType: string } }
    return VoiceRecorder.stopRecording();
  }
}
