import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ChatService } from 'src/app/services/chat.service';
import { ContactsService } from 'src/app/services/contacts.service';
import { PresenceService } from 'src/app/services/presence.service';
import { ChatSettingsService } from 'src/app/services/chat-settings.service';
import { combineLatest, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  IonItemSliding,
  ToastController,
  ActionSheetController,
  AlertController,
  NavController
} from '@ionic/angular';

@Component({
  selector: 'app-chats',
  templateUrl: './chats.page.html',
  styleUrls: ['./chats.page.scss'],
  standalone: false
})
export class ChatsPage implements OnInit, OnDestroy {

  chats: any[] = [];
  filteredChats: any[] = [];
  archivedCount = 0;
  isLoading = true;

  myId = localStorage.getItem('user_id');
  searchTerm = '';

  // Presence
  onlineUsers = new Map<string, boolean>();
  private presenceSubscriptions: Subscription[] = [];
  private subscribedPresenceUsers = new Set<string>();

  // Chat stream
  private chatSubscription?: Subscription;

  // Cache resolved user info
  private resolvedUsers = new Map<string, { name: string; photo: string | null }>();

  constructor(
    private chatService: ChatService,
    private contactService: ContactsService,
    private presenceService: PresenceService,
    private chatSettings: ChatSettingsService,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private nav: NavController,
    private cdr: ChangeDetectorRef
  ) { }

  /* ---------------- LIFECYCLE ---------------- */

  ngOnInit(): void {
    this.loadChats();
  }

  ionViewWillEnter(): void {
    this.loadChats();
  }

  ngOnDestroy(): void {
    this.cleanupPresence();
    this.chatSubscription?.unsubscribe();
  }

  /* ---------------- LOAD CHATS ---------------- */

  private cleanupPresence(): void {
    this.presenceSubscriptions.forEach(s => s.unsubscribe());
    this.presenceSubscriptions = [];
    this.subscribedPresenceUsers.clear();
    this.onlineUsers.clear();
  }

  private loadChats(): void {
    this.chatSubscription?.unsubscribe();
    this.cleanupPresence();
    this.resolvedUsers.clear();

    this.isLoading = true;

    this.contactService.getAllContacts().then(() => {
      this.chatService.getMyChats().pipe(take(1)).subscribe(initialChats => {
        const chatIds = initialChats.map(c => c.id);

        this.chatSettings.loadMultipleSettings(chatIds).then(() => {
          this.chatSubscription = combineLatest([
            this.chatService.getMyChats(),
            this.chatSettings.settings$
          ]).subscribe(([allChats]) => {

            this.chats = [...allChats];

            for (const chat of this.chats) {

              if (chat.isGroup) {
                chat.name = chat.groupName || 'Unnamed Group';
                chat.avatar = chat.groupIcon || null;
                continue;
              }

              const otherId = chat.participants.find(
                (p: any) => String(p) !== String(this.myId)
              );

              if (!otherId) continue;

              chat.otherUserId = otherId;
              this.subscribeToPresence(otherId);

              const cached = this.resolvedUsers.get(otherId);
              if (cached) {
                chat.name = cached.name;
                chat.avatar = cached.photo;
                continue;
              }

              const contact = this.contactService.localContacts.find(
                (c: any) => String(c.user_id) === String(otherId)
              );

              if (contact) {
                chat.name = `${contact.first_name} ${contact.last_name}`;
                chat.avatar = contact.photo_url ?? null;
                this.resolvedUsers.set(otherId, {
                  name: chat.name,
                  photo: chat.avatar
                });
                continue;
              }

              // Fallback async
              chat.name = `User ${otherId.substr(0, 4)}`;
              chat.avatar = null;

              this.chatService.getUserInfo(otherId).then(info => {
                chat.name = info.username;
                chat.avatar = info.photo ?? null;

                this.resolvedUsers.set(otherId, {
                  name: chat.name,
                  photo: chat.avatar
                });

                this.cdr.detectChanges();
              });
            }

            this.archivedCount = this.chats.filter(c =>
              this.chatSettings.isArchived(c.id)
            ).length;

            this.chats = this.chats.filter(c =>
              c.lastMessage &&
              c.lastMessage.trim() !== '' &&
              !this.chatSettings.isArchived(c.id)
            );

            this.sortChats();
            this.filteredChats = [...this.chats];
            this.isLoading = false;
          });
        });
      });
    });
  }

  /* ---------------- SORT ---------------- */

  private sortChats(): void {
    this.chats.sort((a, b) => {
      const pA = this.chatSettings.isPinned(a.id) ? 1 : 0;
      const pB = this.chatSettings.isPinned(b.id) ? 1 : 0;
      if (pA !== pB) return pB - pA;

      const tA = a.lastTimestamp?.seconds || 0;
      const tB = b.lastTimestamp?.seconds || 0;
      return tB - tA;
    });
  }

  /* ---------------- PRESENCE ---------------- */

  private subscribeToPresence(userId: string): void {
    if (this.subscribedPresenceUsers.has(userId)) return;
    this.subscribedPresenceUsers.add(userId);

    const sub = this.presenceService.getPresence(userId).subscribe(p => {
      this.onlineUsers.set(userId, p?.state === 'online');
    });

    this.presenceSubscriptions.push(sub);
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.get(userId) || false;
  }

  /* ---------------- TEMPLATE HELPERS ---------------- */

  trackByChatId(_: number, chat: any): string {
    return chat.id;
  }

  getUnreadCount(chat: any): number {
    return chat[`unread_${this.myId}`] || 0;
  }

  filterChats(event: any): void {
    const term = event.target.value?.toLowerCase() || '';
    this.searchTerm = term;

    if (!term) {
      this.filteredChats = [...this.chats];
      return;
    }

    this.filteredChats = this.chats.filter(c =>
      c.name?.toLowerCase().includes(term)
    );
  }

  /* ---------------- PIN / MUTE / ARCHIVE ---------------- */

  isPinned(chatId: string): boolean {
    return this.chatSettings.isPinned(chatId);
  }

  isMuted(chatId: string): boolean {
    return this.chatSettings.isMuted(chatId);
  }

  async pinChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.togglePin(chatId);
    await slidingItem.close();
    this.sortChats();
    this.filteredChats = [...this.chats];
    this.showToast(this.isPinned(chatId) ? 'Chat pinned' : 'Chat unpinned');
  }

  async muteChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.toggleMute(chatId);
    await slidingItem.close();
    this.showToast(this.isMuted(chatId) ? 'Notifications muted' : 'Notifications unmuted');
  }

  async archiveChat(chatId: string, slidingItem: IonItemSliding) {
    await this.chatSettings.toggleArchive(chatId);
    await slidingItem.close();

    this.chats = this.chats.filter(c => c.id !== chatId);
    this.filteredChats = [...this.chats];
    this.showToast('Chat archived');
  }

  /* ---------------- LONG PRESS MENU ---------------- */

  async presentChatOptions(chat: any) {
    const sheet = await this.actionSheetCtrl.create({
      header: chat.name,
      buttons: [
        {
          text: this.isPinned(chat.id) ? 'Unpin' : 'Pin',
          icon: 'pin',
          handler: () => this.chatSettings.togglePin(chat.id)
        },
        {
          text: this.isMuted(chat.id) ? 'Unmute' : 'Mute',
          icon: 'notifications',
          handler: () => this.chatSettings.toggleMute(chat.id)
        },
        {
          text: 'Archive',
          icon: 'archive',
          handler: () => this.chatSettings.toggleArchive(chat.id)
        },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    sheet.present();
  }

  /* ---------------- UI ---------------- */

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 1500 });
    toast.present();
  }

  async presentMoreOptions() {
    const sheet = await this.actionSheetCtrl.create({
      header: 'More Options',
      buttons: [
        {
          text: 'Starred Messages',
          icon: 'star',
          handler: () => this.nav.navigateForward('/starred-messages')
        },
        {
          text: 'Settings',
          icon: 'settings-outline',
          handler: () => this.nav.navigateForward('/settings')
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' }
      ]
    });
    sheet.present();
  }
}
