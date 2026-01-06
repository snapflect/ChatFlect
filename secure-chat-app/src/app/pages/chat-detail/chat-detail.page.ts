import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, NavController, ModalController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { ApiService } from 'src/app/services/api.service';
import { DomSanitizer } from '@angular/platform-browser';
import { ImageModalPage } from '../image-modal/image-modal.page';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.page.html',
  styleUrls: ['./chat-detail.page.scss'],
  standalone: false
})
export class ChatDetailPage implements OnInit {
  @ViewChild(IonContent, { static: false }) content: IonContent;

  chatId: string | null = null;
  messages: any[] = [];
  newMessage = '';
  currentUserId: any;

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService,
    private auth: AuthService,
    private crypto: CryptoService,
    private api: ApiService,
    private sanitizer: DomSanitizer,
    private nav: NavController,
    private modalController: ModalController
  ) {
    this.auth.currentUserId.subscribe(id => this.currentUserId = String(id));
  }

  ngOnInit() {
    this.chatId = this.route.snapshot.paramMap.get('id');
    if (this.chatId) {
      this.chatService.getMessages(this.chatId).subscribe(msgs => {
        this.messages = msgs;
        setTimeout(() => {
          if (this.content) this.content.scrollToBottom(300);
        }, 100);

        // Auto-decrypt images
        this.messages.forEach(async msg => {
          if (this.isImage(msg.text) && !msg.text._blobUrl) {
            // It's a metadata object. We need to download and decrypt the blob!
            const metadata = msg.text;
            try {
              // 1. Download Encrypted Blob
              const blobEnc = await this.api.getBlob(metadata.url).toPromise();

              // 2. Decrypt Blob
              const myPrivKeyStr = localStorage.getItem('private_key');
              if (myPrivKeyStr && blobEnc) {
                console.log("Found private key and blob. decrypting..."); // LOG
                const myPrivKey = await this.crypto.importKey(myPrivKeyStr, 'private');

                // Determine if this is my message or theirs
                const isMe = String(msg.senderId).trim() === String(this.currentUserId).trim();
                const keyEncBase64 = isMe ? (metadata.ks || metadata.k) : metadata.k;

                if (!keyEncBase64) {
                  console.error("No encryption key found for image! IsMe:", isMe, "Metadata:", metadata);
                  return;
                }

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
                console.log("Image decrypted success!", msg.text._blobUrl); // LOG
              } else {
                console.error("Missing private key or blob. PrivKey:", !!myPrivKeyStr, "Blob:", !!blobEnc);
              }
            } catch (e) {
              console.error("Image Loading Error", e);
            }
          } else {
            if (!msg.text._blobUrl && this.isImage(msg.text)) console.log("Waiting to be decrypted...");
          }
        });
      });

      // Mark as Read
      this.chatService.markAsRead(this.chatId);
    }
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.chatId) return;
    await this.chatService.sendMessage(this.chatId, this.newMessage, this.currentUserId);
    this.newMessage = '';
  }

  async uploadImage(event: any) {
    const file = event.target.files[0];
    if (file && this.chatId) {
      await this.chatService.sendImageMessage(this.chatId, file, this.currentUserId);
    }
  }

  isImage(text: any): boolean {
    return typeof text === 'object' && text !== null && text.type === 'image';
  }

  getImgUrl(text: any) {
    return text._blobUrl || 'assets/placeholder_loading.png'; // Placeholder while loading
  }

  isMyMsg(msg: any): boolean {
    return String(msg.senderId).trim() === String(this.currentUserId).trim();
  }

  async openImage(imgData: any) {
    console.log("Opening image with data:", imgData); // LOG
    await this.modalController.create({
      component: ImageModalPage,
      componentProps: {
        imageUrl: imgData
      }
    }).then(modal => modal.present());
  }

  goBack() {
    this.nav.navigateBack('/tabs/chats');
  }
}
