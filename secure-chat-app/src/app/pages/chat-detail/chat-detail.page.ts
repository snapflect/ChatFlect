import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { ApiService } from 'src/app/services/api.service';
import { DomSanitizer } from '@angular/platform-browser';
import { NavController, ModalController, IonContent, ActionSheetController, ToastController, AlertController } from '@ionic/angular';
import { ImageModalPage } from '../image-modal/image-modal.page';
import { ImagePreviewModalPage } from '../image-preview-modal/image-preview-modal.page';
import { RecordingService } from 'src/app/services/recording.service';
import { Geolocation } from '@capacitor/geolocation';
import { CallService } from 'src/app/services/call.service';
import { ForwardModalPage } from '../forward-modal/forward-modal.page';
import { PopoverController } from '@ionic/angular';
import { ReactionPickerComponent } from 'src/app/components/reaction-picker/reaction-picker.component';
import { LoggingService } from 'src/app/services/logging.service';
// import { ProfilePage } from '../profile/profile.page'; // For Group Info logic later

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.page.html',
  styleUrls: ['./chat-detail.page.scss'],
  standalone: false
})

// ...

export class ChatDetailPage implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  chatId: string | null = null;
  messages: any[] = [];
  newMessage = '';
  currentUserId: any;
  replyingTo: any = null;

  chatName: string = '';
  isGroup: boolean = false;
  participants: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    private auth: AuthService,
    private crypto: CryptoService,
    private api: ApiService,
    private sanitizer: DomSanitizer,
    private nav: NavController,
    private modalController: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private recordingService: RecordingService,
    private callService: CallService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private popoverCtrl: PopoverController,
    private logger: LoggingService
  ) {
    this.auth.currentUserId.subscribe(id => this.currentUserId = String(id));
  }

  // ...

  async ngOnInit() {
    this.chatId = this.route.snapshot.paramMap.get('id');
    if (this.chatId) {
      // Fetch Chat Metadata
      this.chatService.getChatDetails(this.chatId).subscribe((chat: any) => {
        if (chat) {
          this.isGroup = chat.isGroup;
          this.chatName = chat.isGroup ? chat.groupName : 'User';
          this.participants = chat.participants || [];
        }
      });

      // Fetch Messages & Decrypt
      this.chatService.getMessages(this.chatId).subscribe(msgs => {
        this.messages = msgs;
        this.scrollToBottom();

        // Auto-decrypt images & Detect Links
        this.messages.forEach(async msg => {
          // Links
          if (this.getMsgType(msg.text) === 'text') {
            const url = this.extractUrl(msg.text);
            if (url) {
              msg.linkMeta = {
                url: url,
                domain: new URL(url).hostname,
                title: url,
                image: 'https://www.google.com/s2/favicons?domain=' + new URL(url).hostname
              };
            }
          }

          // Generic Auto-Decrypt for Media (Image, Audio, Document)
          if (this.isMedia(msg.text) && !msg.text._blobUrl) {
            const metadata = msg.text;
            try {
              const blobEnc = await this.api.getBlob(metadata.url).toPromise();
              const myPrivKeyStr = localStorage.getItem('private_key');

              if (myPrivKeyStr && blobEnc) {
                const myPrivKey = await this.crypto.importKey(myPrivKeyStr, 'private');
                const isMe = String(msg.senderId).trim() === String(this.currentUserId).trim();
                const keyEncBase64 = isMe ? (metadata.ks || metadata.k) : metadata.k;

                if (!keyEncBase64) return;

                const aesKeyRaw = await window.crypto.subtle.decrypt(
                  { name: "RSA-OAEP" },
                  myPrivKey,
                  this.crypto.base64ToArrayBuffer(keyEncBase64)
                );

                const aesKey = await window.crypto.subtle.importKey(
                  "raw",
                  aesKeyRaw,
                  { name: "AES-GCM" },
                  true,
                  ["encrypt", "decrypt"]
                );

                const blobDec = await this.crypto.decryptBlob(
                  blobEnc,
                  aesKey,
                  new Uint8Array(this.crypto.base64ToArrayBuffer(metadata.i))
                );

                msg.text._blobUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blobDec));
              }
            } catch (e) {
              this.logger.error("Media Decrypt Error", e);
            }
          }
        });

        this.chatService.markAsRead(this.chatId!);
      });
    }
  }

  async makeCall(type: 'audio' | 'video') {
    if (this.isGroup) {
      const t = await this.toastCtrl.create({ message: 'Group calls coming soon!', duration: 2000 });
      t.present();
      return;
    }

    const otherId = this.participants.find(p => String(p) !== String(this.currentUserId));
    if (!otherId) return;

    this.callService.startCall(otherId, type);
  }

  extractUrl(text: string): string | null {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  }

  openLink(url: string) {
    window.open(url, '_blank');
  }

  scrollToBottom() { setTimeout(() => this.content?.scrollToBottom(300), 100); }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.chatId) return;

    // Send with Reply Context
    await this.chatService.sendMessage(
      this.chatId,
      this.newMessage,
      this.currentUserId,
      this.replyingTo
    );

    this.newMessage = '';
    this.replyingTo = null; // Clear reply context
    this.scrollToBottom();
  }

  // --- New Feature Logic ---

  getReactionCount(msg: any): number {
    if (!msg.reactions) return 0;
    return Object.keys(msg.reactions).filter(k => msg.reactions[k]).length;
  }

  getTopReactions(msg: any): string[] {
    if (!msg.reactions) return [];
    // Get unique emojis
    const reactions = Object.values(msg.reactions).filter(v => v) as string[];
    const unique = [...new Set(reactions)];
    return unique.slice(0, 3);
  }

  async presentActionSheet(msg: any) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Message Options',
      buttons: [
        {
          text: 'Reply',
          icon: 'arrow-undo',
          handler: () => { this.replyingTo = msg; }
        },
        {
          text: 'React',
          icon: 'heart',
          handler: () => { this.presentReactionPicker(msg); }
        },
        {
          text: 'Forward',
          icon: 'arrow-redo',
          handler: () => { this.forwardMessage(msg); }
        },
        {
          text: 'Copy',
          icon: 'copy',
          handler: () => { /* Clipboard */ }
        },
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            this.confirmDelete(msg);
          }
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' }
      ]
    });
    await actionSheet.present();
  }

  async confirmDelete(msg: any) {
    const isMe = this.isMyMsg(msg);
    const buttons = [
      {
        text: 'Delete for me',
        handler: () => this.chatService.deleteMessage(this.chatId!, msg.id, false)
      }
    ];

    if (isMe) {
      buttons.push({
        text: 'Delete for everyone',
        handler: () => this.chatService.deleteMessage(this.chatId!, msg.id, true)
      });
    }

    buttons.push({ text: 'Cancel' } as any);

    const alert = await this.alertCtrl.create({
      header: 'Delete Message?',
      buttons: buttons
    });
    await alert.present();
  }

  async forwardMessage(msg: any) {
    const modal = await this.modalController.create({
      component: ForwardModalPage
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.selectedChatId) {
        const targetChatId = result.data.selectedChatId;
        const targetChatName = result.data.selectedChatName;

        const loading = await this.toastCtrl.create({ message: `Forwarding to ${targetChatName}...`, duration: 1000 });
        loading.present();

        // Logic based on types
        const type = this.getMsgType(msg.text);
        if (type === 'text') {
          await this.chatService.sendMessage(targetChatId, msg.text, this.currentUserId);
        } else {
          // Media Forwarding (Zero-Upload)
          // 1. We need the RAW AES Key. 
          // In getMessages, we decrypted it to `msg.text`.
          // But `msg.text` is the Metadata Object.
          // We need to re-decrypt the `k` from Metadata using our Private Key?
          // Wait, `msg.text` is ALREADY the decrypted metadata object if successful.
          // But the metadata object usually contains the *Encrypted* Key for the recipient 'k'. 
          // Ah, in `getMessages`, we used `metadata.k` (encrypted) to get `aesKeyRaw` to decrypt the blob.
          // We did NOT store `aesKeyRaw` in `msg`. We only stored the decrypted blob URL.
          // So we must RE-DERIVE the AES Key from the original metadata.k

          // This is tricky. `msg.text` object in `this.messages` is the *Decrypted* JSON metadata?
          // Let's check `getMessages`.
          // Yes: `const metadata = JSON.parse(decrypted);`
          // So `msg.text` IS the metadata object.
          // And `msg.text.k` IS the encrypted AES key (encrypted with MY public key).
          // So we can re-decrypt `msg.text.k` with MY Private Key to get the AES Key.

          const metadata = msg.text;
          const myPrivKeyStr = localStorage.getItem('private_key');
          if (!myPrivKeyStr || !metadata.k) {
            this.logger.error("Cannot forward: Missing key");
            return;
          }

          const myPrivKey = await this.crypto.importKey(myPrivKeyStr, 'private');

          // Decrypt the AES Key
          const aesKeyRaw = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            myPrivKey,
            this.crypto.base64ToArrayBuffer(metadata.k)
          );

          // Now call Fanout
          await this.chatService.handleMediaFanout(
            targetChatId,
            this.currentUserId,
            metadata, // Reuse metadata (url, size, etc)
            aesKeyRaw,
            `Forwarded ${type}`
          );
        }
      }
    });

    await modal.present();
  }

  async presentReactionPicker(msg: any, event?: any) {
    const popover = await this.popoverCtrl.create({
      component: ReactionPickerComponent,
      cssClass: 'reaction-popover',
      translucent: true,
      // event: event // If called from click, position it. From ActionSheet, centers it.
      // Let's force center or near message if possible. For now, center is fine.
    });

    popover.onDidDismiss().then(async (result) => {
      if (result.data && result.data.reaction) {
        await this.chatService.addReaction(this.chatId!, msg.id, result.data.reaction);
      }
    });

    await popover.present();
  }

  async presentAttachmentMenu() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Share Media',
      buttons: [
        { text: 'Document', icon: 'document', handler: () => { this.pickDocument(); } },
        { text: 'Camera', icon: 'camera', handler: () => { this.logger.log('Open Camera'); } },
        { text: 'Gallery', icon: 'image', handler: () => { this.pickImage(); } },
        { text: 'Audio', icon: 'musical-notes', handler: () => { this.logger.log('Pick Audio'); } },
        { text: 'Location', icon: 'location', handler: () => { this.shareLocation(); } },
        { text: 'Contact', icon: 'person', handler: () => { this.logger.log('Share Contact'); } },
        { text: 'Cancel', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  pickImage() {
    // Trigger file input programmatically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => this.uploadImage(e);
    input.click();
  }

  // --- Voice Recording ---
  isRecording = false;
  recordDuration = 0;
  private recordInterval: any;

  async recordAudio() {
    // 1. Permission Check
    const hasPerm = await this.recordingService.hasPermission();
    if (!hasPerm) {
      const granted = await this.recordingService.requestPermission();
      if (!granted) {
        // Show alert?
        this.logger.error("Permission denied");
        return;
      }
    }

    // 2. Start Recording
    try {
      await this.recordingService.startRecording();
      this.isRecording = true;
      this.recordDuration = 0;
      this.recordInterval = setInterval(() => {
        this.recordDuration++;
      }, 1000);
    } catch (e) {
      this.logger.error("Start Recording Failed", e);
    }
  }

  async stopRecording(send: boolean) {
    clearInterval(this.recordInterval);
    this.isRecording = false;

    try {
      const result = await this.recordingService.stopRecording();

      if (send && result.value.recordDataBase64) {
        // Upload & Send
        const base64 = result.value.recordDataBase64;
        const mime = result.value.mimeType;
        // Convert Base64 to Blob
        const res = await fetch(`data:${mime};base64,${base64}`);
        const blob = await res.blob();

        await this.uploadAudio(blob, Math.round(result.value.msDuration / 1000));
      }
    } catch (e) {
      this.logger.error("Stop Recording Failed", e);
    }
  }

  async uploadAudio(blob: Blob, durationSec: number) {
    await this.chatService.sendAudioMessage(this.chatId!, blob, this.currentUserId, durationSec);
    this.scrollToBottom();
  }

  pickDocument() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*'; // Accept all
    input.onchange = (e: any) => this.uploadDocument(e);
    input.click();
  }

  async uploadDocument(event: any) {
    const file = event.target.files[0];
    if (file && this.chatId) {
      await this.chatService.sendDocumentMessage(this.chatId, file, this.currentUserId);
      this.scrollToBottom();
    }
  }

  async openDocument(docData: any) {
    // Trigger decryption if needed, or if already decrypted (blobUrl), open it
    if (docData._blobUrl && typeof docData._blobUrl === 'object') { // SafeUrl
      const url = docData._blobUrl.changingThisBreaksApplicationSecurity || docData._blobUrl;
      window.open(url, '_blank');
    } else if (typeof docData._blobUrl === 'string') {
      window.open(docData._blobUrl, '_blank');
    } else {
      this.logger.log("Document not ready or decrypted yet");
    }
  }



  async shareLocation() {
    try {
      const hasPerm = await Geolocation.checkPermissions();
      if (hasPerm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') return;
      }

      const position = await Geolocation.getCurrentPosition();
      if (position && position.coords) {
        await this.chatService.sendLocationMessage(
          this.chatId!,
          position.coords.latitude,
          position.coords.longitude,
          this.currentUserId
        );
        this.scrollToBottom();
      }
    } catch (e) {
      this.logger.error("Loc Error", e);
    }
  }

  openLocation(lat: number, lng: number) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  }

  // --- Helpers ---

  async uploadImage(event: any) {
    const file = event.target.files[0];
    if (file && this.chatId) {
      // 1. Compress
      const compressed = await this.compressImage(file);

      // 2. Open Preview Modal
      const modal = await this.modalController.create({
        component: ImagePreviewModalPage,
        componentProps: { imageFile: compressed }
      });

      modal.onDidDismiss().then(async (result) => {
        if (result.role === 'send' && result.data) {
          // 3. Send
          // NOTE: We haven't refactored sendImageMessage to use the new helper in Service yet, 
          // but it still works as is. The Service has the old method too? 
          // Wait, I didn't delete the old sendImageMessage, so it's fine.
          await this.chatService.sendImageMessage(this.chatId!, compressed, this.currentUserId, result.data.caption);
          this.scrollToBottom();
        }
      });

      await modal.present();
    }
  }

  async compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1024; // Resize to max 1024px
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        }, 'image/jpeg', 0.7); // 70% Quality
      };
      img.onerror = (e) => reject(e);
    });
  }

  isImage(text: any): boolean {
    return (typeof text === 'object' && text !== null && text.type === 'image');
  }

  isMedia(text: any): boolean {
    return (typeof text === 'object' && text !== null && ['image', 'audio', 'document'].includes(text.type));
  }

  getMsgType(text: any): string {
    if (typeof text === 'object' && text !== null) return text.type || 'unknown';
    return 'text';
  }

  // --- Audio Logic ---
  currentAudio: HTMLAudioElement | null = null;
  currentPlayingMsg: any = null;

  async toggleAudio(msg: any) {
    if (msg.isPlaying) {
      this.stopAudio();
      return;
    }

    // Stop others
    this.stopAudio();

    if (!msg.text._blobUrl) {
      this.logger.log("Audio not ready or decrypted yet");
      // Try fallback to just URL if generic, but usually _blobUrl is the decrypted one
      return;
    }

    // Get URL (handle SafeUrl)
    let url = msg.text._blobUrl;
    if (typeof url === 'object' && url.changingThisBreaksApplicationSecurity) {
      url = url.changingThisBreaksApplicationSecurity;
    }

    const audio = new Audio(url);
    this.currentAudio = audio;
    this.currentPlayingMsg = msg;

    audio.onended = () => {
      msg.isPlaying = false;
      this.currentAudio = null;
      this.currentPlayingMsg = null;
    };

    // Play
    try {
      await audio.play();
      msg.isPlaying = true; // Update UI
    } catch (e) {
      this.logger.error("Play failed", e);
    }
  }

  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.currentPlayingMsg) {
      this.currentPlayingMsg.isPlaying = false;
      this.currentPlayingMsg = null;
    }
  }

  getImgUrl(text: any) {
    if (typeof text === 'object') return text._blobUrl || text.url || 'assets/placeholder_loading.png';
    return '';
  }

  async openImage(imgData: any) {
    this.logger.log("Opening image with data:", imgData);

    // Extract actual URL string if it's a SafeResourceUrlImpl
    let actualUrl = imgData;
    if (typeof imgData === 'object' && imgData.changingThisBreaksApplicationSecurity) {
      actualUrl = imgData.changingThisBreaksApplicationSecurity;
    }

    await this.modalController.create({
      component: ImageModalPage,
      componentProps: {
        imageUrl: actualUrl // Pass raw string (blob:...)
      }
    }).then(modal => modal.present());
  }

  isMyMsg(msg: any): boolean {
    return String(msg.senderId).trim() === String(this.currentUserId).trim();
  }
  openGroupInfo() {
    if (this.isGroup && this.chatId) {
      this.nav.navigateForward(['/group-info', { id: this.chatId }]);
    }
  }
  goBack() {
    this.nav.back();
  }

  openChatInfo() {
    if (this.isGroup) {
      this.openGroupInfo();
    } else {
      // P2P Info? For now, maybe just toast or nothing
      // this.nav.navigateForward(['/contact-info', { id: ... }]);
    }
  }
}
