import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { PresenceService } from 'src/app/services/presence.service';
import { ChatSettingsService } from 'src/app/services/chat-settings.service';
import { combineLatest, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { IonItemSliding, ToastController, ActionSheetController, AlertController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-chats',
  templateUrl: './chats.page.html',
  styleUrls: ['./chats.page.scss'],
  standalone: false
})
export class ChatsPage implements OnInit, OnDestroy {
  chats: any[] = [];
  archivedCount: number = 0;
  myId = localStorage.getItem('user_id');

  // Online Status Tracking (WhatsApp Parity)
  onlineUsers = new Map<string, boolean>(); // userId -> isOnline
  private presenceSubscriptions: Subscription[] = [];
  private chatSubscription?: Subscription;

  constructor(
    private chatService: ChatService,
    private contactService: ContactsService,
    private presenceService: PresenceService,
    private chatSettings: ChatSettingsService,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private nav: NavController
  ) { }

  // Loading state for skeleton (WhatsApp Parity)
  isLoading: boolean = true;

  ngOnInit() {
    this.loadChats();
  }

  ionViewWillEnter() {
    this.loadChats();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.presenceSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
    }
  }

  resolvedUsers = new Map<string, { name: string, photo: string }>();
  // ...

  loadChats() {
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
    }
    this.isLoading = true;
    // Ensure contacts are loaded first to map Names
    this.contactService.getContacts().then(async () => {
      // First, get initial chats to know what settings to load
      this.chatService.getMyChats().pipe(take(1)).subscribe(async initialChats => {
        const chatIds = initialChats.map(c => c.id);
        await this.chatSettings.loadMultipleSettings(chatIds);

        // Now subscribe to the reactive stream for updates (archive/unarchive)
        this.chatSubscription = combineLatest([
          this.chatService.getMyChats(),
          this.chatSettings.settings$
        ]).subscribe(async ([allChats, settingsMap]) => {
          this.chats = [...allChats];

          // No more loadMultipleSettings here to avoid infinite loop!
          // New chats added in real-time will have default settings until next page refresh
          // or we could add a smarter check here if really needed.

          // Resolve Names
          for (const chat of this.chats) {
            if (chat.isGroup) {
              chat.name = chat.groupName || 'Unnamed Group';
              chat.avatar = chat.groupIcon || 'assets/group-placeholder.png';
            } else {
              const otherId = chat.participants.find((p: any) => String(p) !== String(this.myId));
              if (otherId) {
                chat.otherUserId = otherId;
                this.subscribeToPresence(otherId);

                // Resolver Logic
                if (this.resolvedUsers.has(otherId)) {
                  const cached = this.resolvedUsers.get(otherId);
                  chat.name = cached?.name;
                  chat.avatar = cached?.photo || chat.avatar;
                } else {
                  const contact = this.contactService.localContacts.find((c: any) => String(c.user_id) === String(otherId));
                  if (contact) {
                    chat.name = contact.first_name + ' ' + contact.last_name;
                    chat.avatar = contact.photo_url;
                    this.resolvedUsers.set(otherId, { name: chat.name, photo: chat.avatar });
                  } else {
                    chat.name = `User ${otherId.substr(0, 4)}`;
                    this.chatService.getUserInfo(otherId).then(info => {
                      chat.name = info.username;
                      if (info.photo) chat.avatar = info.photo;
                      this.resolvedUsers.set(otherId, { name: info.username, photo: info.photo });
                    });
                  }
                }
              }
            }
          }

          // Filter out empty and archived chats
          this.archivedCount = this.chats.filter(c => this.chatSettings.isArchived(c.id)).length;

          this.chats = this.chats.filter(c =>
            c.lastMessage && c.lastMessage.trim() !== '' && !this.chatSettings.isArchived(c.id)
          );

          // Sort: Pinned first, then by timestamp
          this.sortChats();
          this.filteredChats = [...this.chats];
          this.isLoading = false;
        });
      });
    });
  }

  /**
   * Sort chats: pinned first, then by timestamp descending (WhatsApp Parity)
   */
  private sortChats() {
    this.chats.sort((a, b) => {
      const aPinned = this.chatSettings.isPinned(a.id) ? 1 : 0;
      const bPinned = this.chatSettings.isPinned(b.id) ? 1 : 0;

      if (aPinned !== bPinned) {
        return bPinned - aPinned; // Pinned first
      }

      // Then by timestamp
      const aTime = a.lastTimestamp?.seconds || 0;
      const bTime = b.lastTimestamp?.seconds || 0;
      return bTime - aTime; // Newest first
    });
  }

  /**
   * Subscribe to a user's online presence (WhatsApp Parity)
   */
  private subscribeToPresence(userId: string) {
    if (this.onlineUsers.has(userId)) return; // Already subscribed

    const sub = this.presenceService.getPresence(userId).subscribe(presence => {
      this.onlineUsers.set(userId, presence?.state === 'online');
    });
    this.presenceSubscriptions.push(sub);
  }

  /**
   * Check if a user is currently online
   */
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.get(userId) || false;
  }

  // --- Swipe Action Handlers (WhatsApp Parity) ---

  async pinChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.togglePin(chatId);
    await slidingItem.close();

    const isPinned = this.chatSettings.isPinned(chatId);
    this.showToast(isPinned ? 'Chat pinned' : 'Chat unpinned');
    this.sortChats();
    this.filteredChats = [...this.chats];
  }

  async muteChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.toggleMute(chatId);
    await slidingItem.close();

    const isMuted = this.chatSettings.isMuted(chatId);
    this.showToast(isMuted ? 'Notifications muted' : 'Notifications unmuted');
  }

  async archiveChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.toggleArchive(chatId);
    await slidingItem.close();

    // Remove from current list
    this.chats = this.chats.filter(c => c.id !== chatId);
    this.filteredChats = [...this.chats];
    this.showToast('Chat archived');
  }

  /**
   * Check if chat is pinned (for UI binding)
   */
  isPinned(chatId: string): boolean {
    return this.chatSettings.isPinned(chatId);
  }

  /**
   * Check if chat is muted (for UI binding)  
   */
  isMuted(chatId: string): boolean {
    return this.chatSettings.isMuted(chatId);
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 1500 });
    toast.present();
  }

  // --- Long Press Menu (WhatsApp Parity) ---

  async presentChatOptions(chat: any) {
    const isPinned = this.chatSettings.isPinned(chat.id);
    const isMuted = this.chatSettings.isMuted(chat.id);

    const buttons = [
      {
        text: isPinned ? 'Unpin' : 'Pin',
        icon: isPinned ? 'pin' : 'pin-outline',
        handler: () => this.pinChatFromMenu(chat.id)
      },
      {
        text: isMuted ? 'Unmute' : 'Mute',
        icon: isMuted ? 'notifications' : 'notifications-off-outline',
        handler: () => this.muteChatFromMenu(chat.id)
      },
      {
        text: 'Archive',
        icon: 'archive-outline',
        handler: () => this.archiveChatFromMenu(chat.id)
      },
      {
        text: 'Delete Chat',
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => this.deleteChatConfirm(chat)
      },
      {
        text: 'Cancel',
        role: 'cancel',
        icon: 'close'
      }
    ];

    const actionSheet = await this.actionSheetCtrl.create({
      header: chat.name,
      buttons: buttons
    });

    await actionSheet.present();
  }

  private async pinChatFromMenu(chatId: string) {
    await this.chatSettings.togglePin(chatId);
    const isPinned = this.chatSettings.isPinned(chatId);
    this.showToast(isPinned ? 'Chat pinned' : 'Chat unpinned');
    this.sortChats();
    this.filteredChats = [...this.chats];
  }

  private async muteChatFromMenu(chatId: string) {
    await this.chatSettings.toggleMute(chatId);
    const isMuted = this.chatSettings.isMuted(chatId);
    this.showToast(isMuted ? 'Notifications muted' : 'Notifications unmuted');
  }

  private async archiveChatFromMenu(chatId: string) {
    await this.chatSettings.toggleArchive(chatId);
    this.chats = this.chats.filter(c => c.id !== chatId);
    this.filteredChats = [...this.chats];
    this.showToast('Chat archived');
  }

  private async deleteChatConfirm(chat: any) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Chat?',
      message: `Delete chat with ${chat.name}? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.chatService.deleteChat(chat.id).then(() => {
              this.chats = this.chats.filter(c => c.id !== chat.id);
              this.filteredChats = [...this.chats];
              this.showToast('Chat deleted');
            });
          }
        }
      ]
    });
    await alert.present();
  }

  filteredChats: any[] = [];
  searchTerm: string = '';

  filterChats(event: any) {
    const term = event.target.value;
    this.searchTerm = term;
    if (!term || term.trim() === '') {
      this.filteredChats = [...this.chats];
      return;
    }

    this.filteredChats = this.chats.filter(c => {
      return c.name.toLowerCase().includes(term.toLowerCase());
      // Optional: Search last message?
      // || c.lastMessage.toLowerCase().includes(term.toLowerCase())
    });
  }

  getUnreadCount(chat: any) {
    return chat[`unread_${this.myId}`] || 0;
  }
  async presentMoreOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'More Options',
      buttons: [
        {
          text: 'Starred Messages',
          icon: 'star',
          handler: () => {
            this.nav.navigateForward('/starred-messages');
          }
        },
        {
          text: 'Settings',
          icon: 'settings-outline',
          handler: () => {
            this.nav.navigateForward('/settings');
          }
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' }
      ]
    });
    await actionSheet.present();
  }
}
