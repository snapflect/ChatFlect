import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LocationService } from 'src/app/services/location.service';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-live-map',
  templateUrl: './live-map.page.html',
  styleUrls: ['./live-map.page.scss'],
  standalone: false
})
export class LiveMapPage implements OnInit, OnDestroy {
  map: L.Map | undefined;
  chatId: string | null = null;
  subscription: Subscription | null = null;
  markers: Map<string, L.Marker> = new Map();
  myId = localStorage.getItem('user_id');

  constructor(
    private route: ActivatedRoute,
    private locService: LocationService,
    private nav: NavController
  ) { }

  ngOnInit() {
    this.chatId = this.route.snapshot.paramMap.get('chatId');
    // If not in param map, check query params?
  }

  ionViewDidEnter() {
    this.initMap();
    if (this.chatId) {
      this.subscribeToLocations();
    }
  }

  initMap() {
    // Leaflet requires container size. ion-content must be ready.
    this.map = L.map('mapId').setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Fix leaf icon path issues in Angular/Webpack
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';
    // We need to ensure these assets exist or use CDN. 
    // Usually leaflet assets are not copied by default unless configured.
    // For MVP, if icons fail, we might see broken images.
    // Let's use CDN for icons to be safe without asset config.
    /*
    const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;
    */
  }

  subscribeToLocations() {
    this.subscription = this.locService.getLocations(this.chatId!).subscribe(locs => {
      this.updateMarkers(locs);
    });
  }

  updateMarkers(locs: any[]) {
    // 1. Add/Update
    const activeIds = new Set();

    locs.forEach(loc => {
      activeIds.add(loc.userId);
      const latLng = new L.LatLng(loc.lat, loc.lng);

      if (this.markers.has(loc.userId)) {
        const marker = this.markers.get(loc.userId);
        marker?.setLatLng(latLng);
      } else {
        const marker = L.marker(latLng)
          .bindPopup(loc.userId === this.myId ? "You" : "User " + loc.userId) // Ideally Name
          .addTo(this.map!);
        this.markers.set(loc.userId, marker);

        // Auto center on first update if it's me?
        if (loc.userId === this.myId) {
          // this.map?.setView(latLng, 15);
        }
      }
    });

    // 2. Remove old
    this.markers.forEach((marker, uid) => {
      if (!activeIds.has(uid)) {
        this.map?.removeLayer(marker);
        this.markers.delete(uid);
      }
    });

    // Fit bounds if multiple points
    if (activeIds.size > 0 && this.map) {
      const group = L.featureGroup(Array.from(this.markers.values()));
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  async stopSharing() {
    await this.locService.stopSharing();
    this.nav.back();
  }

  ngOnDestroy() {
    if (this.subscription) this.subscription.unsubscribe();
    if (this.map) {
      this.map.remove();
    }
  }
}
