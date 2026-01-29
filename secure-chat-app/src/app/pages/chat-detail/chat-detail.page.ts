import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, ViewEncapsulation, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from 'src/app/services/chat.service';
import { AuthService } from 'src/app/services/auth.service';
import { CryptoService } from 'src/app/services/crypto.service';
import { ApiService } from 'src/app/services/api.service';
import { DomSanitizer } from '@angular/platform-browser';
import { ActionSheetController, AlertController, IonContent, ModalController, NavController, Platform, ToastController } from '@ionic/angular';
import { ImageModalPage } from '../image-modal/image-modal.page';
import { ImagePreviewModalPage } from '../image-preview-modal/image-preview-modal.page';
import { RecordingService } from 'src/app/services/recording.service';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Keyboard } from '@capacitor/keyboard';
import { FileOpener } from '@capacitor-community/file-opener';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import { CallService } from 'src/app/services/call.service';
import { ForwardModalPage } from '../forward-modal/forward-modal.page';
import { PopoverController } from '@ionic/angular';
import { ReactionPickerComponent } from 'src/app/components/reaction-picker/reaction-picker.component';
import { LoggingService } from 'src/app/services/logging.service';
// ... imports
import { PresenceService } from 'src/app/services/presence.service';
import { LocationService } from 'src/app/services/location.service';
import { SoundService } from 'src/app/services/sound.service';
import { ContactPickerModalPage } from '../contact-picker-modal/contact-picker-modal.page';
import { SecureMediaService } from 'src/app/services/secure-media.service';
import { TransferProgressService } from 'src/app/services/transfer-progress.service';
import { combineLatest } from 'rxjs';

// ... 

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.page.html',
  styleUrls: ['./chat-detail.page.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false
})

export class ChatDetailPage implements OnInit, OnDestroy {
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  @ViewChild('chatInput') chatInput!: ElementRef;

  chatId: string | null = null;
  messages: any[] = [];
  filteredMessages: any[] = [];
  chatDetails: any = null;
  newMessage = '';
  currentUserId: any;
  replyingTo: any = null;

  chatName: string = '';
  chatPic: string | null = null;
  isGroup: boolean = false;
  participants: string[] = [];
  otherUserId: string | null = null;

  // Presence
  otherUserPresence: any = null;
  typingUsers: string[] = [];

  // Header Shadow
  isScrolled: boolean = false;

  // Offline State
  isOnline: boolean = true;
  private networkListener: any;

  // Search State
  isSearchActive: boolean = false;
  searchTerm: string = '';

  // Group Participants Cache
  participantsMap = new Map<string, any>();

  // Mention State
  showMentionPicker: boolean = false;
  mentionFilteredParticipants: any[] = [];
  mentionSearchTerm: string = '';

  // Scroll to Bottom FAB
  showScrollFab: boolean = false;
  private scrollThreshold: number = 200;

  // Selection Mode
  isSelectionMode: boolean = false;
  selectedMessages = new Set<string>();

  // Lazy Loading State
  messagesMap = new Map<string, any>();
  isLoadingOlder = false;

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
    private cdr: ChangeDetectorRef,
    private recordingService: RecordingService,
    private callService: CallService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private popoverCtrl: PopoverController,
    private logger: LoggingService,
    private presence: PresenceService,
    private locationService: LocationService,
    private soundService: SoundService,
    private secureMedia: SecureMediaService,
    public progressService: TransferProgressService,
    private zone: NgZone
  ) {
    this.auth.currentUserId.subscribe(id => this.currentUserId = String(id));
  }

  ngOnDestroy() {
    this.soundService.clearActiveChat();
    if (this.networkListener) this.networkListener.remove();
    this.chatPic = null;
    this.chatName = '';
    this.otherUserPresence = null;
  }

  ionViewWillEnter() {
    // START WITH CLEAN SLATE - Fixes "First File Missing" bug
    this.messages = [];
    this.messagesMap.clear();
    this.filteredMessages = [];

    // Reset Header State
    this.chatPic = null;
    this.chatName = '';
    this.otherUserPresence = null;

    this.chatId = this.route.snapshot.paramMap.get('id');
    if (this.chatId) {
      this.chatService.markAsRead(this.chatId);
    }
  }

  async initNetwork() {
    const status = await Network.getStatus();
    this.isOnline = status.connected;
    this.networkListener = Network.addListener('networkStatusChange', status => {
      this.zone.run(() => { this.isOnline = status.connected; });
    });
  }

  async ngOnInit() {
    this.initNetwork();
    this.chatId = this.route.snapshot.paramMap.get('id');
    if (this.chatId) {
      this.soundService.setActiveChat(this.chatId);
      this.chatService.getChatDetails(this.chatId).subscribe(async (chat: any) => {
        if (chat) {
          this.chatDetails = chat;
          this.isGroup = chat.isGroup;
          this.participants = chat.participants || [];

          if (this.isGroup) {
            this.chatName = chat.groupName;
            this.chatPic = chat.groupImage || 'assets/user.png';
          } else {
            // 1:1 Chat - Find the other user and fetch their profile
            const otherId = this.participants.find(p => String(p) !== String(this.currentUserId)) || null;
            this.otherUserId = otherId;

            if (otherId) {
              try {
                const profile: any = await this.auth.getProfile(otherId);
                if (profile) {
                  this.chatName = profile.first_name || profile.username || 'User';
                  if (profile.last_name) this.chatName += ' ' + profile.last_name;
                  const pUrl = profile.photo_url || profile.img || profile.avatar_url;
                  this.chatPic = pUrl || 'assets/user.png';
                } else {
                  this.chatName = 'User';
                }
              } catch (e) {
                console.error("Profile Fetch Error", e);
                this.chatName = 'User';
              }
              this.presence.getPresence(otherId).subscribe(p => {
                this.otherUserPresence = p;
              });
            }
          }

          if (this.participants.length > 0) {
            this.participants.forEach(async (uid) => {
              if (String(uid) === String(this.currentUserId)) return;
              if (!this.participantsMap.has(String(uid))) {
                try {
                  const p: any = await this.auth.getProfile(String(uid));
                  if (p) {
                    const pUrl = p.photo_url || p.img || p.avatar_url;
                    this.participantsMap.set(String(uid), {
                      name: (p.first_name || p.username),
                      photo: pUrl || 'assets/user.png'
                    });
                  }
                } catch (e) { console.warn("Failed to load profile for", uid); }
              }
            });
          }

          if (chat.typing) {
            const now = Date.now();
            const typingIds = Object.keys(chat.typing).filter(uid => {
              const ts = chat.typing[uid];
              return (now - ts < 5000) && (String(uid) !== String(this.currentUserId));
            });
            this.typingUsers = typingIds;
          } else {
            this.typingUsers = [];
          }

          const unreadKey = `unread_${this.currentUserId}`;
          if (chat[unreadKey] && chat[unreadKey] > 0) {
            this.chatService.markAsRead(this.chatId!);
          }
        }

        combineLatest([
          this.chatService.getMessages(this.chatId || ''),
          this.chatService.pendingMessages$
        ]).subscribe(([msgs, pendingMap]) => {
          const pending = pendingMap[this.chatId!] || [];
          this.mergeMessages(msgs, pending);
        });
      });
    }
  }






  // --- Lazy Loading Logic ---

  mergeMessages(realMsgs: any[], pendingMsgs: any[]) {
    // 1. Add/Update Real Messages
    realMsgs.forEach(m => this.messagesMap.set(m.id, m));

    // 2. Prepare Matchers for Deduplication
    // We create a robust index of "Real" messages to check against.
    const realMsgIndex = realMsgs.map(m => {
      const t = m.text || {};
      return {
        id: m.id,
        // Check all possible locations for tempId
        tempId: m.tempId || t.tempId || t._tempId,
        // Create a content signature for fuzzy matching
        // usage: type + name + size (params that shouldn't change between local and server)
        // For images/video: type + caption + approx_timestamp? 
        // Timestamp is risky due to server time drift.
        // Size is good for docs/video. Name is good for docs.
        signature: this.createSignature(m)
      };
    });

    const filteredPending = pendingMsgs.filter(p => {
      // If the pending msg is already in the map as a real message ID (unlikely but possible if IDs collide)
      if (this.messagesMap.has(p.id)) return false;

      const pTempId = p.id;
      const pSignature = this.createSignature(p);

      // Layer 1: Strict ID Match
      // Check multiple locations for tempId (root, text, _tempId)
      const strictMatch = realMsgIndex.find(r => {
        const anyR = r as any; // Cast to access text prop
        const rTemp = anyR.tempId || anyR.text?.tempId || anyR.text?._tempId;
        return rTemp == pTempId;
      });

      if (strictMatch) {
        // console.log(`[Dedup] Strict Match Found: ${pTempId}`);
        return false;
      }

      // Layer 2: Fuzzy Content Match (Only for my own messages)
      if (String(p.senderId) === String(this.currentUserId)) {
        if (pSignature && pSignature.length > 5) {
          const fuzzyMatch = realMsgIndex.find(r => {
            // Check root signature OR text signature
            const anyR = r as any;
            const rSig = anyR.signature || anyR.text?.signature;
            return rSig === pSignature;
          });

          if (fuzzyMatch) {
            // console.log(`[Dedup] Fuzzy Match Found: ${pSignature}`);
            return false;
          }
        }
      }

      return true; // Keep pending
    });

    // 3. Add Verified Pending Messages to Map
    filteredPending.forEach(p => this.messagesMap.set(p.id, p));

    // 4. Convert Map to Array & Sort
    const allMsgs = Array.from(this.messagesMap.values());

    // Sort: Ascending Timestamp
    allMsgs.sort((a, b) => {
      const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : a.timestamp;
      const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : b.timestamp;
      return tA - tB;
    });

    this.messages = allMsgs;
    this.removeDuplicates(); // NUCLEAR OPTION: Final sweep
    this.filterMessages();
  }

  // Aggressive Post-Processing to kill duplicates
  removeDuplicates() {
    const realTempIds = new Set<string>();
    const realSignatures = new Set<string>();

    // 1. Index Real Messages
    this.messages.forEach(m => {
      // If it's a real message (from Firestore)
      if (m.id && (m.id.startsWith('msg_') || !m.id.startsWith('up_'))) {
        // Index TempID
        const t = m.tempId || m.text?.tempId || m.text?._tempId;
        if (t) realTempIds.add(t);

        // Index Signature
        const anyM = m as any;
        const s = anyM.signature || anyM.text?.signature;
        if (s && s.length > 5) realSignatures.add(s);
      }
    });

    // 2. Filter Pending Messages
    this.messages = this.messages.filter(m => {
      // If it's a pending message
      if (m.id && m.id.startsWith('up_')) {
        // Check ID Match
        if (realTempIds.has(m.id)) {
          // console.log(`[Nuclear] Killed Pending via ID: ${m.id}`);
          return false;
        }

        // Check Signature Match
        const sig = this.createSignature(m);
        if (sig && realSignatures.has(sig)) {
          // console.log(`[Nuclear] Killed Pending via Sig: ${sig}`);
          return false;
        }
      }
      return true;
    });

    // Only scroll to bottom on INITIAL load (small size) or if user was at bottom
    if (!this.isLoadingOlder && this.messages.length <= 25 && !this.isSearchActive) {
      this.scrollToBottom();
    }
  }

  createSignature(msg: any): string {
    const t = msg.text || {};
    // 3. Last Resort: Type-based content signature
    const type = msg.type;
    if (type === 'document') {
      if (t.name && t.size) return `doc_${this.chatId}_${t.name}_${t.size}`;
    } else if (type === 'image') {
      return `image_${this.chatId}_${t.size || 0}_${t.caption || 'nc'}`;
    } else if (type === 'video') {
      return `video_${this.chatId}_${t.size || 0}_${t.caption || 'nc'}`;
    }
    return '';
  }

  filterMessages() {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredMessages = [...this.messages];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredMessages = this.messages.filter(msg => {
        // Text messages
        if (msg.type === 'text' && typeof msg.text === 'string') {
          return msg.text.toLowerCase().includes(term);
        }
        // Caption in media
        if (msg.text && msg.text.caption) {
          return msg.text.caption.toLowerCase().includes(term);
        }
        return false;
      });
    }
  }

  toggleSearch() {
    this.isSearchActive = !this.isSearchActive;
    if (!this.isSearchActive) {
      this.searchTerm = '';
      this.filterMessages();
    } else {
      // Focus input? 
      setTimeout(() => {
        // logic to focus searchbar id
      }, 100);
    }
  }

  // --- Helpers ---

  getSenderProfile(userId: string) {
    if (String(userId) === String(this.currentUserId)) return { name: 'You', photo: null };
    return this.participantsMap.get(String(userId)) || { name: 'Unknown', photo: 'assets/user.png' };
  }



  async loadMoreMessages(event: any) {
    if (this.isLoadingOlder || !this.chatId || this.messages.length === 0) {
      event.target.complete();
      return;
    }

    this.isLoadingOlder = true;

    // Oldest message (first in ASC sorted list)
    const oldestMsg = this.messages[0];
    const oldestTs = oldestMsg.timestamp; // Pass the whole object or timestamp depending on Service Implementation
    // Service expects: timestamp or snapshot. 
    // Firestore `startAfter` needs the value matching the `orderBy` field.
    // We order by `timestamp` DESC in `getOlderMessages`.
    // Wait, `getOlderMessages` queries DESC so `startAfter` means "older than".
    // Correct.

    try {
      // Capture current scroll height to maintain position
      const scrollElement = await this.content.getScrollElement();
      const oldScrollHeight = scrollElement.scrollHeight;
      const oldScrollTop = scrollElement.scrollTop;

      const olderMsgs = await this.chatService.getOlderMessages(this.chatId, oldestTs);

      if (olderMsgs && olderMsgs.length > 0) {
        olderMsgs.forEach(m => this.messagesMap.set(m.id, m));
        // Re-sort
        this.mergeMessages([], []); // Re-trigger sort using existing map.
        // Wait, mergeMessages expects args. Let's make args optional or refactor.
        // Refactor mergeMessages to use internal map + args.

        // Just manually trigger sort assignment:
        const allMsgs = Array.from(this.messagesMap.values());
        allMsgs.sort((a, b) => {
          const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : a.timestamp;
          const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : b.timestamp;
          return tA - tB;
        });
        this.messages = allMsgs;
        this.filterMessages();

        // Restore Scroll Position
        // Angular change detection needs to run first
        this.cdr.detectChanges();

        const newScrollHeight = scrollElement.scrollHeight;
        const heightDiff = newScrollHeight - oldScrollHeight;

        // Scroll to new position (which is conceptually the same place visually)
        // top = prevTop + diff
        // If we were at 0 (top), we want to be at `heightDiff`.
        // `scrollByPoint(0, heightDiff, 0)` could work.
        // or `scrollToPoint(0, heightDiff + oldScrollTop, 0)`.
        // `scrollToPoint` is safer (no animation: 0 duration).

        // console.log(`Restoring scroll: OldH=${oldScrollHeight}, NewH=${newScrollHeight}, Diff=${heightDiff}`);
        await this.content.scrollToPoint(0, heightDiff + (oldScrollTop || 0), 0);

      }
    } catch (e) {
      console.error("Load Older Failed", e);
    } finally {
      this.isLoadingOlder = false;
      event.target.complete();
    }
  }


  // Typing Handler
  onTyping() {
    if (this.chatId && this.currentUserId) {
      this.chatService.setTyping(this.chatId, this.currentUserId);
    }

    // Clear after 3s of no typing (Debounce)
    if ((this as any).typingTimer) clearTimeout((this as any).typingTimer);
    (this as any).typingTimer = setTimeout(() => {
      if (this.chatId) this.chatService.setTyping(this.chatId, false);
    }, 3000);


    // Check for Mention
    if (this.isGroup) {
      const cursorPosition = this.chatInput?.nativeElement?.selectionStart || this.newMessage.length;
      const textUpToCursor = this.newMessage.substring(0, cursorPosition);
      const lastAt = textUpToCursor.lastIndexOf('@');

      if (lastAt !== -1 && (lastAt === 0 || textUpToCursor[lastAt - 1] === ' ')) {
        const term = textUpToCursor.substring(lastAt + 1);
        // If term has space, we might stop searching or allow simple names. 
        // WhatsApp stops if newline. Let's allow spaces for names up to a limit or until next symbol.
        if (!term.includes('\n')) {
          this.mentionSearchTerm = term;
          this.filterMentions(term);
          return;
        }
      }
    }
    this.showMentionPicker = false;
  }

  filterMentions(term: string) {
    const allParts = Array.from(this.participantsMap.values());
    if (!term.trim()) {
      this.mentionFilteredParticipants = allParts;
    } else {
      const lower = term.toLowerCase();
      this.mentionFilteredParticipants = allParts.filter(p => p.name.toLowerCase().includes(lower));
    }
    this.showMentionPicker = this.mentionFilteredParticipants.length > 0;
  }

  addMention(user: any) {
    const cursorPosition = this.chatInput?.nativeElement?.selectionStart || this.newMessage.length;
    const textUpToCursor = this.newMessage.substring(0, cursorPosition);
    const lastAt = textUpToCursor.lastIndexOf('@');
    const textAfterCursor = this.newMessage.substring(cursorPosition);

    const prefix = textUpToCursor.substring(0, lastAt);
    // Insert Name + Space
    const inserted = `@${user.name} `;

    this.newMessage = prefix + inserted + textAfterCursor;
    this.showMentionPicker = false;

    // Restore focus and cursor? 
    setTimeout(() => {
      this.chatInput?.nativeElement?.focus();
      // Attempt to set cursor end of inserted
    }, 50);
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

  scrollToBottom() {
    setTimeout(() => {
      this.content?.scrollToBottom(300);
      this.showScrollFab = false; // Hide FAB when scrolled to bottom
    }, 100);
  }

  /**
   * Handles scroll events to show/hide scroll-to-bottom FAB
   */
  getMediaProgress(msg: any) {
    const id = msg.text?._tempId || msg.text?.url;
    if (!id) return null;
    return this.progressService.getProgress(id);
  }

  async onScroll(event: any) {
    const scrollElement = await this.content.getScrollElement();
    const scrollTop = scrollElement.scrollTop;
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = scrollElement.clientHeight;

    // Distance from bottom
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show FAB if scrolled up more than threshold
    this.showScrollFab = distanceFromBottom > this.scrollThreshold;

    // Header Shadow
    this.isScrolled = scrollTop > 10;
  }

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

    // Refocus for persistent "notepad" feel
    setTimeout(() => {
      if (this.chatInput && this.chatInput.nativeElement) {
        this.chatInput.nativeElement.focus();
      }
    }, 50);
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
    // If in selection mode, long press should probably just toggle selection
    if (this.isSelectionMode) {
      this.toggleSelection(msg);
      return;
    }

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Message Options',
      buttons: [
        {
          text: 'Reply',
          icon: 'arrow-undo',
          handler: () => { this.replyingTo = msg; }
        },
        {
          text: 'Select',
          icon: 'checkbox-outline',
          handler: () => { this.enterSelectionMode(msg); }
        },
        {
          text: 'React',
          icon: 'heart',
          handler: () => { this.presentReactionPicker(msg); }
        },
        {
          text: this.isStarred(msg) ? 'Unstar' : 'Star',
          icon: this.isStarred(msg) ? 'star' : 'star-outline',
          handler: () => { this.toggleStar(msg); }
        },
        {
          text: 'Forward',
          icon: 'arrow-redo',
          handler: () => { this.forwardMessage(msg); }
        },
        {
          text: 'Copy',
          icon: 'copy',
          handler: () => { this.copyToClipboard(msg); }
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

  // --- Selection Mode Logic (Priority 2) ---

  onMessageLongPress(msg: any) {
    if (!this.isSelectionMode) {
      this.enterSelectionMode(msg);
    } else {
      this.toggleSelection(msg);
    }
  }

  enterSelectionMode(msg: any) {
    this.isSelectionMode = true;
    this.selectedMessages.clear();
    this.selectedMessages.add(msg.id);
  }

  toggleSelection(msg: any) {
    if (this.selectedMessages.has(msg.id)) {
      this.selectedMessages.delete(msg.id);
      if (this.selectedMessages.size === 0) {
        this.exitSelectionMode();
      }
    } else {
      this.selectedMessages.add(msg.id);
    }
  }

  exitSelectionMode() {
    this.isSelectionMode = false;
    this.selectedMessages.clear();
  }

  isSelected(msgId: string): boolean {
    return this.selectedMessages.has(msgId);
  }

  isStarred(msg: any): boolean {
    return msg.starredBy?.includes(this.currentUserId);
  }

  async toggleStar(msg: any) {
    const star = !this.isStarred(msg);
    await this.chatService.toggleStarMessage(this.chatId!, msg.id, star);
    if (!star) {
      this.showToast('Message unstarred');
    }
  }

  async starSelectedMessages() {
    const ids = Array.from(this.selectedMessages);
    const messagesToStar = this.messages.filter(m => ids.includes(m.id));

    // Determine if we should star or unstar (if all are starred, unstar them)
    const allStarred = messagesToStar.every(m => this.isStarred(m));
    const action = !allStarred;

    for (const msg of messagesToStar) {
      await this.chatService.toggleStarMessage(this.chatId!, msg.id, action);
    }

    this.showToast(action ? `${ids.length} messages starred` : `${ids.length} messages unstarred`);
    this.exitSelectionMode();
  }

  // TrackBy function for efficient DOM updates
  trackByMsgId(index: number, item: any): string {
    return item.id;
  }

  async deleteSelectedMessages() {
    const ids = Array.from(this.selectedMessages);
    if (ids.length === 0) return;

    // Get message objects to check ownership and time
    const messagesToDelete = this.messages.filter(m => ids.includes(m.id));

    // Check if ALL selected messages are mine (for "Delete for Everyone" option)
    const allMine = messagesToDelete.every(m => this.isMyMsg(m));

    // Check if ALL selected messages are within 24h limit (for "Delete for Everyone")
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const withinTimeLimit = messagesToDelete.every(m => {
      // Use timestamp (seconds) or createdAt (Date object/string) depending on your data model
      const msgTime = m.timestamp ? (m.timestamp.seconds ? m.timestamp.seconds * 1000 : m.timestamp) : 0;
      return (now - msgTime) < oneDayMs;
    });

    const buttons: any[] = [
      { text: 'Cancel', role: 'cancel' }
    ];

    // "Delete for Everyone" option: Only if ALL are mine and within time limit
    if (allMine && withinTimeLimit) {
      buttons.push({
        text: 'Delete for Everyone',
        role: 'destructive',
        handler: () => {
          this.zone.run(async () => {
            this.exitSelectionMode(); // Exit first to clear selection UI

            for (const id of ids) {
              // Optimistic update
              const msg = this.messages.find(m => m.id === id);
              if (msg) {
                msg.type = 'revoked';
                msg.text = { type: 'revoked' };
              }
              // Also update in filteredMessages
              const fMsg = this.filteredMessages.find(m => m.id === id);
              if (fMsg) {
                fMsg.type = 'revoked';
                fMsg.text = { type: 'revoked' };
              }
            }
            // Force *ngFor re-render by destructively updating array reference
            this.filteredMessages = [...this.filteredMessages];
            this.cdr.detectChanges();

            for (const id of ids) {
              await this.chatService.deleteMessage(this.chatId!, id, true);
            }
          });
        }
      });
    }

    // "Delete for Me" option: Always available
    buttons.push({
      text: 'Delete for Me',
      role: 'destructive',
      handler: () => {
        this.zone.run(async () => {
          this.exitSelectionMode();

          this.messages = this.messages.filter(m => !ids.includes(m.id));
          this.filteredMessages = this.filteredMessages.filter(m => !ids.includes(m.id));
          this.cdr.detectChanges();

          for (const id of ids) {
            await this.chatService.deleteMessage(this.chatId!, id, false);
          }
        });
      }
    });

    const alert = await this.alertCtrl.create({
      header: `Delete ${this.selectedMessages.size} messages?`,
      buttons: buttons
    });
    await alert.present();
  }

  async forwardSelectedMessages() {
    const modal = await this.modalController.create({
      component: ForwardModalPage
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.selectedChatId) {
        const targetChatId = result.data.selectedChatId;
        const targetChatName = result.data.selectedChatName;

        const loading = await this.toastCtrl.create({ message: `Forwarding ${this.selectedMessages.size} messages to ${targetChatName}...`, duration: 2000 });
        loading.present();

        const messagesToForward = this.messages.filter(m => this.selectedMessages.has(m.id));
        for (const msg of messagesToForward) {
          await this.processForward(msg, targetChatId);
        }
        this.exitSelectionMode();
      }
    });

    await modal.present();
  }

  /**
   * Reusable forward logic (Priority 2)
   */
  private async processForward(msg: any, targetChatId: string) {
    const type = this.getMsgType(msg.text);

    // 1. Forward Text
    if (type === 'text') {
      // Use distributeSecurePayload for text to include metadata (forwarded: true)
      // Or just standard sendMessage if metadata not supported.
      // Standard sendMessage doesn't support metadata easily without changing signature.
      // Let's use distributeSecurePayload with 'text' type.

      const sessionKey = await this.crypto.generateSessionKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await this.crypto.encryptPayload(msg.text, sessionKey, iv);
      const ivBase64 = this.crypto.arrayBufferToBase64(iv.buffer);

      await this.chatService.distributeSecurePayload(
        targetChatId,
        this.currentUserId,
        'text',
        ciphertext,
        ivBase64,
        sessionKey,
        { forwarded: true }
      );
    }
    // 2. Forward Media (Image, Video, Audio, Document, Location)
    else {
      let sessionKey: CryptoKey | null = null;
      let ivBase64 = msg.iv || msg.text?.i || ''; // Check both locations

      // Metadata construction
      const metadata: any = {
        forwarded: true,
        type: type // Explicit type
      };

      // Extract specific fields based on type
      if (msg.text) {
        if (msg.text.url || msg.text.file_url) metadata.url = msg.text.url || msg.text.file_url;
        if (msg.text.mime) metadata.mime = msg.text.mime;
        if (msg.text.name) metadata.name = msg.text.name;
        if (msg.text.size) metadata.size = msg.text.size;
        if (msg.text.d) metadata.d = msg.text.d; // Duration
        if (msg.text.caption) metadata.caption = msg.text.caption;
        if (msg.text.thumb) metadata.thumb = msg.text.thumb;
        if (msg.text.lat) metadata.lat = msg.text.lat;
        if (msg.text.lng) metadata.lng = msg.text.lng;
        if (msg.text.viewOnce) metadata.viewOnce = msg.text.viewOnce; // Preserve logic? Or strip? WhatsApp strips viewOnce on forward usually. Let's strip it for safety/logic.
        delete metadata.viewOnce;
      }

      // Key recovery
      if (msg._decryptedKey) {
        sessionKey = await window.crypto.subtle.importKey(
          "raw",
          msg._decryptedKey,
          "AES-GCM",
          true,
          ["encrypt", "decrypt"]
        );
      } else if (msg.text && (msg.text.k || msg.text.ks)) {
        // Attempt to use the key from metadata if we can't get the decrypted key directly?
        // This is tricky without re-decrypting using private key.
        // BUT, if the user is viewing the message, it SHOULD have been decrypted and cached in _decryptedKey or similar service cache.
        // If not detailed, we warn.
        // For now, assume _decryptedKey is populated by the UI/Service when loading messages.
        // If null, we might be forwarding a message we haven't successfully decrypted yet.
      }

      if (!sessionKey) {
        this.showToast('Wait for media to load before forwarding.');
        return;
      }

      await this.chatService.distributeSecurePayload(
        targetChatId,
        this.currentUserId,
        type,
        '', // No new ciphertext for media usually, or re-encrypt? 
        // Wait, DistributeSecurePayload expects ciphertext for TEXT, but for MEDIA it might expect it in metadata or empty?
        // See sendImageMessage: passes '' as ciphertext, but relies on metadata.url which is the encrypted file.
        // AND it passes 'ivBase64'.
        ivBase64,
        sessionKey,
        metadata
      );
    }
  }

  isJson(str: any) {
    try { JSON.parse(str); } catch (e) { return false; }
    return true;
  }

  copyToClipboard(msg: any) {
    const text = this.getMsgContent(msg);
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard');
      });
    }
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
      // Only allow delete-for-everyone within 1 hour of sending
      const msgTimestamp = msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp;
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      if (msgTimestamp && msgTimestamp > oneHourAgo) {
        buttons.push({
          text: 'Delete for everyone',
          handler: () => this.chatService.deleteMessage(this.chatId!, msg.id, true)
        });
      }
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

        await this.processForward(msg, targetChatId);
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
        { text: 'Contact', icon: 'person', handler: () => { this.pickContact(); } },
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

    // Reset input
    event.target.value = '';

    // Open Preview Modal
    const modal = await this.modalController.create({
      component: ImagePreviewModalPage,
      componentProps: {
        file: file,
        viewOnceAvailable: true // FEATURE FLAG
      }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.confirmed) {
        const caption = result.data.caption || '';
        const viewOnce = result.data.viewOnce || false;

        if (file.type.startsWith('video/')) {
          await this.handleVideoUpload(file, caption, viewOnce);
        } else {
          await this.processImageUpload(file, caption, viewOnce);
        }
      }
    });

    await modal.present();
  }

  async processImageUpload(file: File, caption: string, viewOnce: boolean) {
    if (!this.chatId) return;
    const load = await this.toastCtrl.create({ message: 'Sending Image...', duration: 1000 });
    load.present();

    await this.chatService.sendImageMessage(this.chatId, file, this.currentUserId, caption, viewOnce);
    this.scrollToBottom();
  }

  async handleVideoUpload(file: File, caption: string = '', viewOnce: boolean = false) {
    if (!this.chatId) return;
    const load = await this.toastCtrl.create({ message: 'Processing Video...', duration: 2000 });
    load.present();

    // Generate Thumbnail and get Duration
    const { thumb, duration } = await this.generateVideoThumbnail(file);

    await this.chatService.sendVideoMessageClean(
      this.chatId,
      file,
      this.currentUserId,
      duration,
      thumb,
      caption,
      viewOnce
    );
    this.scrollToBottom();
  }

  generateVideoThumbnail(file: File): Promise<{ thumb: Blob | null, duration: number }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.currentTime = 1; // Capture at 1s

      video.onloadedmetadata = () => {
        const duration = Math.round(video.duration) || 10;
        // Wait for seek to complete
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            URL.revokeObjectURL(video.src); // Cleanup
            resolve({ thumb: blob, duration });
          }, 'image/jpeg', 0.7);
        };
      };
      video.onerror = () => resolve({ thumb: null, duration: 10 });
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

  // ... (Live Location methods moved to line ~1067)

  showEmojiPicker = false;

  toggleEmojiPicker() {
    const wasOpen = this.showEmojiPicker;
    this.showEmojiPicker = !this.showEmojiPicker;

    if (this.showEmojiPicker) {
      // Opening emoji picker -> Blur input & Hide keyboard
      const textarea = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (textarea) textarea.blur();

      Keyboard.hide().catch(() => { });
    } else if (wasOpen) {
      // Closing emoji picker -> Focus textarea to show keyboard
      setTimeout(() => {
        const textarea = document.querySelector('.chat-input') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        }
      }, 100);
    }
  }

  onInputFocus() {
    // Close emoji picker when keyboard opens
    if (this.showEmojiPicker) {
      this.showEmojiPicker = false;
    }
  }

  addEmoji(event: any) {
    if (!this.newMessage) this.newMessage = '';
    this.newMessage += event.emoji.native;

    // Resume typing tracking
    this.onTyping();
  }

  addEmojiDirect(emoji: string) {
    if (!this.newMessage) this.newMessage = '';
    this.newMessage += emoji;
    this.onTyping();
  }

  async captureMedia() {
    try {
      // Show action sheet to choose photo or video
      const actionSheet = await this.actionSheetCtrl.create({
        header: 'Capture Media',
        buttons: [
          {
            text: 'Take Photo',
            icon: 'camera',
            handler: () => { this.takePhoto(); }
          },
          {
            text: 'Record Video',
            icon: 'videocam',
            handler: () => { this.recordVideo(); }
          },
          {
            text: 'Cancel',
            icon: 'close',
            role: 'cancel'
          }
        ]
      });
      await actionSheet.present();
    } catch (e) {
      this.logger.error('Capture media failed', e);
    }
  }

  private async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });

      if (image.webPath && this.chatId) {
        // Fetch the image blob
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Compress and send
        const compressed = await this.compressImage(file);
        await this.chatService.sendImageMessage(this.chatId, compressed, this.currentUserId, '');
        this.scrollToBottom();
      }
    } catch (e) {
      this.logger.error('Take photo failed', e);
    }
  }

  private async recordVideo() {
    // Note: Capacitor Camera doesn't support video directly
    // Fallback to file input for video
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file && this.chatId) {
        // sendVideoMessage args: chatId, videoBlob, senderId, duration, thumbnailBlob, caption
        await this.chatService.sendVideoMessage(this.chatId, file, this.currentUserId, 0, null, '');
        this.scrollToBottom();
      }
    };
    input.click();
  }

  sendSticker(url: string) {
    if (!this.chatId) return;
    this.chatService.sendStickerMessage(this.chatId, url, this.currentUserId);
    // WhatsApp parity: Keep picker open after sending sticker
    // this.showEmojiPicker = false; 
  }

  isSticker(msg: any): boolean {
    return msg && msg.type === 'sticker' && !!msg.url;
  }

  getStickerUrl(msg: any): string {
    return msg.url;
  }

  async openDocument(docData: any) {
    try {
      // 1. Decrypt and get blob URL via SecureMediaService
      const blobUrl = await this.secureMedia.getMedia(
        docData.url,
        docData.k,
        docData.i
      ).toPromise();

      if (!blobUrl) {
        this.showToast('Failed to load document');
        return;
      }

      // 2. Fetch the blob
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      // 3. Convert to base64 for Filesystem
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });

      // 4. Save to device (Persistent Cache)
      // Use original name or timestamp
      const fileName = docData.name || 'doc_' + Date.now();
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      // 5. Open with FileOpener (Directly in correct app)
      await FileOpener.open({
        filePath: savedFile.uri,
        contentType: docData.mime || 'application/octet-stream'
      });

    } catch (e) {
      this.logger.error('Open document failed', e);
      // Fallback: system share sheet if opener fails
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: docData.name || 'Document', url: docData.url });
      } catch (inner) {
        this.showToast('Could not open file');
      }
    }
  }

  // --- Voice Recording ---
  isRecording = false;
  recordDuration = 0;
  private recordInterval: any;

  // Swipe-to-cancel tracking
  recordStartX = 0;
  recordCancelled = false;
  swipeOffset = 0;

  async startRecordingTouch(event: TouchEvent | MouseEvent) {
    // Capture start position
    if (event instanceof TouchEvent) {
      this.recordStartX = event.touches[0].clientX;
    } else {
      this.recordStartX = event.clientX;
    }
    this.recordCancelled = false;
    this.swipeOffset = 0;

    await this.recordAudio();
  }

  onRecordingMove(event: TouchEvent | MouseEvent) {
    if (!this.isRecording) return;

    let currentX: number;
    if (event instanceof TouchEvent) {
      currentX = event.touches[0].clientX;
    } else {
      currentX = event.clientX;
    }

    this.swipeOffset = this.recordStartX - currentX;

    // If swiped left more than 100px, cancel
    if (this.swipeOffset > 100) {
      this.recordCancelled = true;
    } else {
      this.recordCancelled = false;
    }
  }

  async endRecordingTouch() {
    if (!this.isRecording) return;

    if (this.recordCancelled) {
      // Cancel - don't send
      await this.stopRecording(false);
    } else {
      // Send recording
      await this.stopRecording(true);
    }
    this.swipeOffset = 0;
    this.recordCancelled = false;
  }

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

  async uploadDocument(event: any) {
    const file = event.target.files[0];
    if (file && this.chatId) {
      await this.chatService.sendDocumentMessage(this.chatId, file, this.currentUserId);
      this.scrollToBottom();
    }
  }

  pickDocument() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*'; // Accept all
    input.onchange = (e: any) => this.uploadDocument(e);
    input.click();
  }

  get isMe(): boolean {
    return false; // Deprecated. Use isMyMsg(msg) in loops.
  }

  // openDocument moved to line ~853

  // retryDecrypt removed - directives handle retries now


  async openVideo(vidData: any) {
    try {
      // Videos are already decrypted via Directive for preview.
      // But for full-screen external opening, we decrypt again to a local file.
      const blobUrl = await this.secureMedia.getMedia(
        vidData.url,
        vidData.k,
        vidData.i
      ).toPromise();

      if (!blobUrl) return;

      const response = await fetch(blobUrl);
      const blob = await response.blob();

      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const fileName = 'video_' + Date.now() + '.mp4';
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      await FileOpener.open({
        filePath: savedFile.uri,
        contentType: 'video/mp4'
      });
    } catch (e) {
      this.logger.error("Video Open Error", e);
      // Fallback: window.open as before
      if (vidData._blobUrl) {
        window.open(vidData._blobUrl, '_system');
      }
    }
  }





  async pickContact() {
    if (!this.chatId) return;
    const modal = await this.modalController.create({
      component: ContactPickerModalPage
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.contact) {
        await this.chatService.sendContactMessage(this.chatId!, result.data.contact, this.currentUserId);
        this.scrollToBottom();
      }
    });

    await modal.present();
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
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Reverse geocode to get address label
        const label = await this.reverseGeocode(lat, lng);

        await this.chatService.sendLocationMessage(
          this.chatId!,
          lat,
          lng,
          this.currentUserId,
          label
        );
        this.scrollToBottom();
      }
    } catch (e) {
      this.logger.error("Loc Error", e);
    }
  }


  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ChatFlect/1.0' }
      });
      const data = await response.json();
      if (data.display_name) {
        // Extract shorter version (city, country)
        const address = data.address || {};
        const parts = [address.city || address.town || address.village, address.country].filter(Boolean);
        return parts.join(', ') || data.display_name.split(',').slice(0, 2).join(',');
      }
    } catch (e) {
      this.logger.error("Geocode failed", e);
    }
    return 'Shared Location';
  }

  viewLiveMap() {
    if (this.chatId) {
      this.nav.navigateForward(['/live-map', { chatId: this.chatId }]);
    }
  }

  async openImage(mediaData: any) {
    const modal = await this.modalController.create({
      component: ImageModalPage,
      componentProps: {
        imageUrl: mediaData.url,
        key: mediaData.k,
        iv: mediaData.i
      }
    });
    await modal.present();
  }

  openLocation(locData: any) {
    const lat = locData?.lat || 0;
    const lng = locData?.lng || 0;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  }

  getStaticMapUrl(lat: number, lng: number): string {
    // Using OpenStreetMap Static Map API (free, no key required)
    // Alternative: Use Leaflet's tile server directly via a canvas approach, but this is simpler
    return `https://static-maps.yandex.ru/1.x/?lang=en&ll=${lng},${lat}&z=15&l=map&size=300,200&pt=${lng},${lat},pm2rdl`;
  }

  // --- Live Location Methods ---

  async shareLiveLocation() {
    const alert = await this.alertCtrl.create({
      header: 'Share Live Location',
      message: 'Choose how long to share your live location',
      inputs: [
        { type: 'radio', label: '15 minutes', value: 15 },
        { type: 'radio', label: '1 hour', value: 60, checked: true },
        { type: 'radio', label: '8 hours', value: 480 }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Share',
          handler: (duration) => {
            if (duration) this.startLiveShare(duration);
          }
        }
      ]
    });
    await alert.present();
  }

  private async startLiveShare(durationMinutes: number) {
    if (!this.chatId) return;
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      // 1. Start location tracking
      await this.locationService.startSharing(this.chatId, durationMinutes);
      // 2. Send message to chat
      await this.chatService.sendLiveLocationMessage(
        this.chatId,
        pos.coords.latitude,
        pos.coords.longitude,
        this.currentUserId,
        durationMinutes
      );
      this.showToast('Live location started');
      // 3. Open live map view
      this.nav.navigateForward(['/live-map', { chatId: this.chatId }]);
    } catch (e) {
      this.logger.error('Live location failed', e);
      this.showToast('Failed to share location');
    }
  }

  getLiveRemaining(locData: any): number {
    if (!locData?.expiresAt) return 0;
    return Math.max(0, locData.expiresAt - Date.now());
  }

  formatLiveRemaining(locData: any): string {
    const ms = this.getLiveRemaining(locData);
    if (ms <= 0) return 'Expired';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m remaining`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m remaining`;
  }

  openLiveMap() {
    if (this.chatId) {
      this.nav.navigateForward(['/live-map', { chatId: this.chatId }]);
    }
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

  formatAudioDuration(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    if (typeof text === 'object' && text !== null) {
      if (text.type) return text.type;
      if (text.lat && text.lng) return text.expiresAt ? 'live_location' : 'location';
      if (text.url || text.file_url) return 'image';
      return 'unknown';
    }
    if (typeof text === 'string') {
      if (text === 'live_location') return 'live_location';
      if (text === 'location') return 'location';
      if (text.startsWith('{')) {
        try {
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string' && parsed.startsWith('{')) {
            try { parsed = JSON.parse(parsed); } catch (e) { }
          }
          if (parsed.type) return parsed.type;
          if (parsed.lat && parsed.lng) return parsed.expiresAt ? 'live_location' : 'location';
        } catch (e) { }
      }
    }
    return 'text';
  }

  async openViewOnce(msg: any, type: 'image' | 'video') {
    if (this.isMyMsg(msg)) {
      this.showToast("You sent this as View Once.");
      return;
    }

    if (msg.viewed) {
      this.showToast("Already opened");
      return;
    }

    const modal = await this.modalController.create({
      component: ImageModalPage,
      componentProps: {
        imageUrl: type === 'image' ? msg.text.url : null,
        videoUrl: type === 'video' ? msg.text.url : null,
        pymKey: msg.text.k, // These keys should be RAW or decrypted if we have them. 
        // Note: SecureSrc usually handles decryption if passed key/iv. 
        // If we decrypted it in Service, we have raw key in 'k'.
        pymIv: msg.text.i,
        caption: msg.text.caption,
        // isViewOnce: true // Prevent saving
      }
    });

    await modal.present();
    await modal.onDidDismiss();

    // Mark as viewed locally
    msg.viewed = true;

    // Force Change Detection
    this.cdr.detectChanges();
  }

  getDocIcon(mime: string): string {
    if (!mime) return 'document-outline';
    if (mime.includes('pdf')) return 'document-text-outline';
    if (mime.includes('word') || mime.includes('doc')) return 'document-outline';
    if (mime.includes('excel') || mime.includes('sheet')) return 'grid-outline';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return 'archive-outline';
    if (mime.includes('image')) return 'image-outline';
    return 'document-outline';
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }



  getMsgContent(msg: any): string {
    if (!msg || !msg.text) return '';
    if (typeof msg.text === 'string') {
      if (msg.text.startsWith('{')) {
        try {
          let parsed = JSON.parse(msg.text);
          if (parsed.type || (parsed.lat && parsed.lng)) return '';
        } catch (e) { }
      }
      // Fallback for service-level strings
      if (msg.text === 'live_location' || msg.text === 'location') return '';
      return msg.text;
    }
    if (typeof msg.text === 'object') {
      return ''; // Handled by specific UI
    }
    return '';
  }

  getReplyText(replyTo: any): string {
    if (!replyTo || !replyTo.text) return '';
    const type = this.getMsgType(replyTo.text);
    if (type !== 'text') {
      const typeLabels: any = {
        'image': '📷 Photo',
        'video': '🎥 Video',
        'audio': '🎤 Audio',
        'location': '📍 Location',
        'live_location': '📍 Live Location',
        'contact': '👤 Contact',
        'document': '📄 Document'
      };
      return typeLabels[type] || 'Media';
    }
    const txt = typeof replyTo.text === 'string' ? replyTo.text : '';
    return txt.length > 50 ? txt.substring(0, 50) + '...' : txt;
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

  toggleAudioSpeed(audio: any) {
    if (!audio) return;
    let rate = audio.playbackRate || 1;
    if (rate === 1) rate = 1.5;
    else if (rate === 1.5) rate = 2;
    else rate = 1;

    audio.playbackRate = rate;
    // Force change detection if needed, but DOM updates usually behave.
    // To update the text binding {{ audio.playbackRate }}, we might need to trigger CD.
    // The template binding to a DOM property might not update automatically on change unless we force it or use a variable.
    // However, if we click, the event cycle runs.

    // Better: Helper Text function?
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



  isMyMsg(msg: any): boolean {
    return String(msg.senderId).trim() === String(this.currentUserId).trim();
  }
  openGroupInfo() {
    if (this.isGroup && this.chatId) {
      this.nav.navigateForward(['/group-info', this.chatId]);
    }
  }



  // --- Date Separator Logic (WhatsApp Parity) ---

  /**
   * Returns a human-readable date label: "Today", "Yesterday", or formatted date
   */
  getDateLabel(timestamp: any): string {
    if (!timestamp?.seconds) return '';

    const msgDate = new Date(timestamp.seconds * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time portion for comparison
    const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (msgDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (msgDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      // Format: "Jan 10" or "Jan 10, 2025" if different year
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      if (msgDate.getFullYear() !== today.getFullYear()) {
        options.year = 'numeric';
      }
      return msgDate.toLocaleDateString('en-US', options);
    }
  }

  /**
   * Determines if a date separator should be shown above the message at given index
   */
  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true; // Always show for first message

    const currentMsg = this.filteredMessages[index];
    const previousMsg = this.filteredMessages[index - 1];

    if (!currentMsg?.timestamp?.seconds || !previousMsg?.timestamp?.seconds) {
      return false;
    }

    const currentDate = new Date(currentMsg.timestamp.seconds * 1000);
    const previousDate = new Date(previousMsg.timestamp.seconds * 1000);

    // Compare date only (not time)
    return currentDate.toDateString() !== previousDate.toDateString();
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
          icon: 'time-outline',
          handler: () => this.promptDisappearingMessages()
        },
        {
          text: 'Search',
          icon: 'search-outline',
          handler: () => { this.toggleSearch(); }
        },
        {
          text: 'View Contact',
          icon: 'person-outline',
          handler: () => { this.openContactInfo(); }
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

  openContactInfo() {
    if (this.isGroup) {
      this.nav.navigateForward(['/group-info', this.chatId]);
    } else if (this.otherUserId) {
      this.nav.navigateForward(['/contact-info'], {
        queryParams: {
          userId: this.otherUserId,
          chatId: this.chatId
        }
      } as any);
    }
  }

  async saveContact(contactData: any) {
    // Use Capacitor Contacts plugin to save to device
    try {
      // For now, show a toast with vCard-like data for manual save
      // Full native save requires @capacitor-community/contacts with write permission
      const name = contactData.name || 'Unknown';
      const phone = (contactData.phones && contactData.phones[0]) || '';

      // Create a tel: link for quick dialing / saving
      const saveUrl = `tel:${phone}`;
      window.open(saveUrl, '_system');

      this.showToast(`Opening ${name} (${phone})`);
    } catch (e) {
      this.logger.error("Save contact failed", e);
      this.showToast("Unable to save contact");
    }
  }

  async startChatWithContact(contactData: any) {
    const phone = (contactData.phones && contactData.phones[0]) || '';
    const name = contactData.name || 'Unknown';
    if (!phone) {
      this.showToast("No phone number available");
      return;
    }

    // For MVP: Show toast indicating the phone number
    // Full implementation would search users collection for phone match
    this.showToast(`Start chat with ${name}: ${phone} - Feature coming soon`);
  }

  isRead(msg: any): boolean {
    if (!this.chatDetails || !this.otherUserId || this.isGroup) return false;
    const lastRead = this.chatDetails[`last_read_${this.otherUserId}`];
    return lastRead && (msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp) <= lastRead;
  }

  // --- New WhatsApp Parity Helpers ---

  linkify(text: any): string {
    if (!text || typeof text !== 'string') return '';

    // 1. Linkify URLs
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    let html = text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" class="chat-link">${url}</a>`;
    });

    // 2. Linkify Mentions (@Name)
    // Simple regex: @ followed by word chars. 
    // Capturing complex names is hard without known list, but visually highlighting @Words is a start.
    const mentionRegex = /(@\w+(\s\w+)?)/g;
    html = html.replace(mentionRegex, (match) => {
      return `<span class="chat-mention">${match}</span>`;
    });

    return html;
  }

  getSenderColor(userId: string): string {
    const colors = ['#e542a3', '#1f7aec', '#009a88', '#faac04', '#e10505'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  }

  scrollToMessage(msgId: string) {
    const el = document.getElementById(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-msg');
      setTimeout(() => el.classList.remove('highlight-msg'), 2000);
    } else {
      const index = this.messages.findIndex(m => m.id === msgId);
      if (index > -1) {
        // If virtual scroll or not rendered yet, manual calc might be needed
        this.showToast("Message loaded but not in view");
      }
    }
  }

}
