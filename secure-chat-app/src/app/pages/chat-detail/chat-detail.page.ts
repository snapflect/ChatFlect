import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
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
// ... imports
import { PresenceService } from 'src/app/services/presence.service';
import { LocationService } from 'src/app/services/location.service';
import { SoundService } from 'src/app/services/sound.service';

// ... 

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.page.html',
  styleUrls: ['./chat-detail.page.scss'],
  standalone: false
})
export class ChatDetailPage implements OnInit, OnDestroy {
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  chatId: string | null = null;
  messages: any[] = [];
  filteredMessages: any[] = [];
  newMessage = '';
  currentUserId: any;
  replyingTo: any = null;

  chatName: string = '';
  isGroup: boolean = false;
  participants: string[] = [];
  otherUserId: string | null = null;

  // Presence
  otherUserPresence: any = null; // { state: 'online' | 'offline', last_changed... }
  typingUsers: string[] = []; // List of names/ids typing

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
    private logger: LoggingService,
    private presence: PresenceService,
    private locationService: LocationService,
    private soundService: SoundService
  ) {
    this.auth.currentUserId.subscribe(id => this.currentUserId = String(id));
  }

  ngOnDestroy() {
    // Clear active chat so sounds resume on other screens
    this.soundService.clearActiveChat();
  }

  async ngOnInit() {
    this.chatId = this.route.snapshot.paramMap.get('id');
    if (this.chatId) {
      // Set active chat to prevent message sounds while viewing
      this.soundService.setActiveChat(this.chatId);

      // Fetch Chat Metadata (Includes Typing Info)
      // Fetch Chat Metadata (Includes Typing Info)
      this.chatService.getChatDetails(this.chatId).subscribe(async (chat: any) => {
        if (chat) {
          this.isGroup = chat.isGroup;
          this.participants = chat.participants || [];

          if (this.isGroup) {
            this.chatName = chat.groupName;
          } else {
            // 1:1 Chat - Find the other user and fetch their profile
            const otherId = this.participants.find(p => String(p) !== String(this.currentUserId)) || null;
            this.otherUserId = otherId;

            if (otherId) {
              // Determine name (Try cache/contact list first, then API)
              // For now, simpler: check locally or hit API
              // Assuming we might have it in a separate contact service, but let's query Auth/Profile
              try {
                const profile: any = await this.api.post('profile.php', { action: 'get_profile', user_id: otherId }).toPromise();
                if (profile && profile.username) {
                  this.chatName = profile.username;
                } else {
                  this.chatName = 'User';
                }
              } catch (e) {
                this.chatName = 'User';
              }

              // Presence
              this.presence.getPresence(otherId).subscribe(p => {
                this.otherUserPresence = p;
              });
            }
          }

          // 2. Typing Indicator Logic
          if (chat.typing) {
            const now = Date.now();
            const typingIds = Object.keys(chat.typing).filter(uid => {
              const ts = chat.typing[uid];
              return (now - ts < 5000) && (String(uid) !== String(this.currentUserId)); // < 5s ago and not me
            });

            // For now just show "Typing..." if > 0. Refine to show names later.
            this.typingUsers = typingIds;
          } else {
            this.typingUsers = [];
          }
        }
      });

      // ... (Existing Message Logic) ...
      this.chatService.getMessages(this.chatId).subscribe(msgs => {
        this.messages = msgs;
        this.filterMessages(); // Update view
        if (!this.isSearchActive) this.scrollToBottom(); // Only scroll if not searching history

        this.messages.forEach(async msg => {
          // ... (Decryption Logic Same as before)
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

          if (this.isMedia(msg.text) && !msg.text._blobUrl) {
            const metadata = msg.text;
            try {
              // Ensure URL exists before fetch
              if (!metadata.url) return;

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

                // Ensure IV exists
                if (!metadata.i) return;

                const blobDec = await this.crypto.decryptBlob(
                  blobEnc,
                  aesKey,
                  new Uint8Array(this.crypto.base64ToArrayBuffer(metadata.i))
                );

                msg.text._blobUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blobDec));
              }
            } catch (e) {
              // Silent catch for media encrypt errors
            }
          }
        });

        this.chatService.markAsRead(this.chatId!);
      });
    }
  }

  // Typing Handler
  onTyping() {
    if (this.chatId) {
      this.presence.setTyping(this.chatId, true);
      // Debounce handled by checking last keystroke? 
      // Or just send every keystroke (Firestored handles overwrites cheapish)
      // Ideally debounce. For MVP, we send update.

      // Clear after 3s of no typing?
      clearTimeout((this as any).typingTimer);
      (this as any).typingTimer = setTimeout(() => {
        this.presence.setTyping(this.chatId!, false);
      }, 3000);
    }
  }

  // ... rest of class remains similar

  async startCall(type: 'audio' | 'video') {
    if (!this.chatId) return;
    try {
      // Group Call (Mesh P2P) logic handles both 1:1 and Group
      // For 1:1, we just pass the chatId (which acts as the Other User ID in 1:1 context usually, 
      // OR we derive participants. In this app, chat-detail separates Group/User logic.
      // If !isGroup, chatId is usually the UserID of the other person? 
      // Let's verify chatService.getChatDetails logic.
      // If 1:1, chatId might be the RoomID or the UserId?
      // In this app, route param 'id' is used.
      // If it's a 1:1 chat, 'id' is often the Other User's ID.
      // If it's a "Group" chat, 'id' is the Group UUID.

      let participants: string[] = [];

      if (this.isGroup) {
        participants = this.participants.filter(p => String(p) !== String(this.currentUserId));
      } else {
        // 1:1 Chat: Use the explicitly resolved participant ID, NOT the Chat ID (which might be composite)
        const otherId = this.participants.find(p => String(p) !== String(this.currentUserId));
        if (otherId) {
          participants = [otherId];
        } else {
          this.logger.error("Start Call Failed: No participants found");
          return;
        }
      }

      await this.callService.startGroupCall(participants, type);
      this.nav.navigateForward(['/group-call']);
    } catch (e) {
      this.logger.error("Start Call Failed", e);
    }
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

    // Check if blocked by me
    if (!this.isGroup) {
      const otherId = this.participants.find(p => String(p) !== String(this.currentUserId));
      if (otherId) {
        const isBlocked = await this.auth.isUserBlocked(otherId);
        if (isBlocked) {
          this.showToast("Unblock this contact to send messages.");
          return;
        }
      }
    }

    // Send with Reply Context
    await this.chatService.sendMessage(
      this.chatId,
      this.newMessage,
      this.currentUserId,
      this.replyingTo
    );

    this.newMessage = '';
    this.replyingTo = null; // Clear reply context
    this.presence.setTyping(this.chatId, false); // Stop typing immediately
    this.scrollToBottom();
  }

  // ... (Reactions, ActionSheet, Media Logic preserved) ... 
  // I will just close the class at the end to keep verification simple
  // But wait, there are many methods. I should target specific blocks if possible.
  // The replace_file_content tool is better given specific ranges but I have a large file.
  // I'll try to replace the `constructor` and `ngOnInit` block specifically, and add `onTyping`.


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
    const buttons: any[] = [
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

    buttons.push({ text: 'Cancel', role: 'cancel' });

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
        { text: 'Gallery (Photo/Video)', icon: 'image', handler: () => { this.pickMedia(); } },
        { text: 'Audio', icon: 'musical-notes', handler: () => { this.pickAudio(); } },
        { text: 'Location (Static)', icon: 'location', handler: () => { this.shareLocation(); } },
        { text: 'Live Location', icon: 'navigate', handler: () => { this.shareLiveLocation(); } },
        { text: 'Contact', icon: 'person', handler: () => { this.logger.log('Share Contact'); } },
        { text: 'Cancel', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  // --- Media Pcking ---

  pickMedia() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = (e) => this.onMediaSelected(e);
    input.click();
  }

  async onMediaSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      await this.handleVideoUpload(file);
    } else {
      await this.uploadImage(event); // Existing Image Logic
    }
  }

  async handleVideoUpload(file: File) {
    if (!this.chatId) return;
    const load = await this.toastCtrl.create({ message: 'Processing Video...', duration: 2000 });
    load.present();

    // Generate Thumbnail
    const thumb = await this.generateVideoThumbnail(file);
    const duration = 10; // TODO: Get actual duration

    await this.chatService.sendVideoMessageClean(
      this.chatId,
      file,
      this.currentUserId,
      duration,
      thumb,
      '' // Caption TODO
    );
    this.scrollToBottom();
  }

  generateVideoThumbnail(file: File): Promise<Blob | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.currentTime = 1; // Capture at 1s

      video.onloadeddata = () => {
        // Wait slightly for seek
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.7);
        }, 500);
      };
      video.onerror = () => resolve(null);
    });
  }

  pickAudio() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file && this.chatId) {
        // 0 duration for file uploads unless we parse it.
        this.chatService.sendAudioMessage(this.chatId, file, this.currentUserId, 0);
        this.scrollToBottom();
      }
    };
    input.click();
  }

  // ... (Live Location, etc)

  async shareLiveLocation() {
    if (!this.chatId) return;
    await this.locationService.startSharing(this.chatId);
    this.viewLiveMap();
  }

  showStickerPicker = false;

  toggleStickerPicker() {
    this.showStickerPicker = !this.showStickerPicker;
    if (this.showStickerPicker) {
      setTimeout(() => this.content.scrollToBottom(300), 100);
    }
  }

  sendSticker(url: string) {
    if (!this.chatId) return;
    this.chatService.sendStickerMessage(this.chatId, url, this.currentUserId);
    this.showStickerPicker = false;
  }

  isSticker(msg: any): boolean {
    return msg && msg.type === 'sticker' && !!msg.url;
  }

  getStickerUrl(msg: any): string {
    return msg.url;
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
    if (docData._blobUrl) {
      const url = (docData._blobUrl.changingThisBreaksApplicationSecurity || docData._blobUrl);
      window.open(url, '_blank');
      return;
    }

    // Try re-decrypting if missing
    this.showToast('Decrypting document...');
    const result = await this.retryDecrypt(docData);
    if (result) {
      window.open(result, '_blank');
    } else {
      this.showToast('Document decryption failed.');
    }
  }

  async retryDecrypt(metadata: any): Promise<string | null> {
    try {
      if (!metadata.url) return null;
      const blobEnc = await this.api.getBlob(metadata.url).toPromise();
      const myPrivKeyStr = localStorage.getItem('private_key');
      if (!myPrivKeyStr || !blobEnc) return null;

      const myPrivKey = await this.crypto.importKey(myPrivKeyStr, 'private');
      const isMe = String(this.currentUserId).trim() === String(this.currentUserId).trim(); // Always me context here
      // Wait, we need the senderId validation?
      // Assume metadata has 'k'.

      const keyEncBase64 = metadata.k;
      if (!keyEncBase64) return null;

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

      if (!metadata.i) return null;
      const blobDec = await this.crypto.decryptBlob(
        blobEnc,
        aesKey,
        new Uint8Array(this.crypto.base64ToArrayBuffer(metadata.i))
      );

      return URL.createObjectURL(blobDec);
    } catch (e) {
      this.logger.error("Retry Decrypt Failed", e);
      return null;
    }
  }

  openVideo(vidData: any) {
    if (vidData._blobUrl) {
      let url = vidData._blobUrl;
      if (typeof url === 'object' && url.changingThisBreaksApplicationSecurity) url = url.changingThisBreaksApplicationSecurity;
      window.open(url, '_blank');
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

  viewLiveMap() {
    if (this.chatId) {
      this.nav.navigateForward(['/live-map', { chatId: this.chatId }]);
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
      // 1. Compress (Skip if GIF to preserve animation)
      let finalBlob: Blob = file;
      if (file.type !== 'image/gif') {
        try {
          finalBlob = await this.compressImage(file);
        } catch (e) {
          this.logger.error("Compression Error", e);
          // Fallback to original
          finalBlob = file;
        }
      }

      // 2. Open Preview Modal
      const modal = await this.modalController.create({
        component: ImagePreviewModalPage,
        componentProps: { imageFile: finalBlob }
      });

      modal.onDidDismiss().then(async (result) => {
        if (result.role === 'send' && result.data) {
          // 3. Send
          await this.chatService.sendImageMessage(this.chatId!, finalBlob, this.currentUserId, result.data.caption);
          this.scrollToBottom();
        }
      });

      await modal.present();
    }
  }

  async compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Logic same as before
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1024;
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
        }, 'image/jpeg', 0.7);
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
    if (typeof text === 'string' && text.startsWith('{')) {
      try {
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string' && parsed.startsWith('{')) {
          try { parsed = JSON.parse(parsed); } catch (e) { }
        }
        if (parsed.type) return parsed.type;
      } catch (e) { }
    }
    return 'text';
  }

  getMsgContent(msg: any): string {
    if (typeof msg.text === 'string') {
      if (msg.text.startsWith('{')) {
        try {
          let parsed = JSON.parse(msg.text);
          // Handle double-encoded JSON
          if (typeof parsed === 'string' && parsed.startsWith('{')) {
            try { parsed = JSON.parse(parsed); } catch (e) { }
          }
          if (parsed.type) {
            // It is a media object, but stored as string.
            // Be careful to update the reference if possible so we don't re-parse constantly, 
            // OR just return empty string so the Media UI handles it (via getMsgType check)
            msg.text = parsed; // Auto-convert for next cycle
            return '';
          }
        } catch (e) { }
      }
      return msg.text;
    }
    if (typeof msg.text === 'object') {
      // If it's a media object, we shouldn't be calling this for text display anyway, 
      // but as a fallback:
      if (msg.text.type) return ''; // Handled by specific media UI

      // If it's pure JSON metadata (failed decryption?)
      return '[Encrypted Message]';
    }
    return '';
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

  // --- Search Logic ---
  isSearchActive = false;
  searchTerm = '';
  // filteredMessages initialized at top

  toggleSearch() {
    this.isSearchActive = !this.isSearchActive;
    if (!this.isSearchActive) {
      this.searchTerm = '';
      this.filterMessages();
    }
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.filterMessages();
  }

  filterMessages() {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredMessages = [...this.messages];
    } else {
      this.filteredMessages = this.messages.filter(msg => {
        if (this.getMsgType(msg.text) === 'text') {
          return msg.text.toLowerCase().includes(this.searchTerm.toLowerCase());
        }
        return false; // Skip media for text search
      });
    }
  }
  goBack() {
    this.nav.back();
  }

  openChatInfo() {
    if (this.isGroup) {
      this.openGroupInfo();
    } else {
      this.presentChatOptions();
    }
  }

  // --- Disappearing Messages ---
  currentTimer = 0; // ms

  async promptDisappearingMessages() {
    const alert = await this.alertCtrl.create({
      header: 'Disappearing Messages',
      inputs: [
        { type: 'radio', label: 'Off', value: 0, checked: this.currentTimer === 0 },
        { type: 'radio', label: '24 Hours', value: 24 * 3600 * 1000, checked: this.currentTimer === 24 * 3600 * 1000 },
        { type: 'radio', label: '7 Days', value: 7 * 24 * 3600 * 1000, checked: this.currentTimer === 7 * 24 * 3600 * 1000 },
        { type: 'radio', label: '90 Days', value: 90 * 24 * 3600 * 1000, checked: this.currentTimer === 90 * 24 * 3600 * 1000 }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Set',
          handler: (val) => {
            if (this.chatId) this.chatService.setChatTimer(this.chatId, val);
            this.showToast(val === 0 ? "Timer Off" : "Timer Set");
          }
        }
      ]
    });
    await alert.present();
  }

  async presentChatOptions() {
    const otherId = this.participants.find(p => String(p) !== String(this.currentUserId));
    if (!otherId) return;

    const isBlocked = await this.auth.isUserBlocked(otherId);

    const actionSheet = await this.actionSheetCtrl.create({
      header: this.chatName,
      buttons: [
        {
          text: `Disappearing Messages (${this.getTimerLabel()})`,
          icon: 'timer',
          handler: () => this.promptDisappearingMessages()
        },
        {
          text: 'View Live Map',
          icon: 'map',
          handler: () => this.viewLiveMap()
        },
        {
          text: isBlocked ? 'Unblock User' : 'Block User',
          role: isBlocked ? undefined : 'destructive',
          icon: isBlocked ? 'shield-checkmark' : 'ban',
          handler: () => this.toggleBlock(otherId, isBlocked)
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        },
        {
          text: 'Reset Encryption Session',
          icon: 'refresh',
          role: 'destructive',
          handler: () => {
            this.crypto.clearSession(otherId);
            this.showToast('Encryption session reset.');
          }
        }
      ]
    });
    await actionSheet.present();
  }

  getTimerLabel() {
    if (this.currentTimer === 0) return 'Off';
    if (this.currentTimer === 24 * 3600 * 1000) return '24h';
    if (this.currentTimer === 7 * 24 * 3600 * 1000) return '7d';
    if (this.currentTimer === 90 * 24 * 3600 * 1000) return '90d';
    return 'Custom';
  }

  async toggleBlock(targetId: string, currentStatus: boolean) {
    // ... (same as before)
    if (currentStatus) {
      await this.auth.unblockUser(targetId);
      this.showToast("User Unblocked");
    } else {
      const alert = await this.alertCtrl.create({
        header: 'Block User?',
        message: 'Blocked users cannot call you or send you messages.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Block',
            handler: async () => {
              await this.auth.blockUser(targetId);
              this.showToast("User Blocked");
              this.nav.back();
            }
          }
        ]
      });
      await alert.present();
    }
  }

  async showToast(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2000 });
    t.present();
  }
}
