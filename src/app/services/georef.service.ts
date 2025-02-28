import { Injectable } from '@angular/core';
import { MapService } from './map.service';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
  ) {}

  isGeorefActive = false; // Gère l'affichage de la partie droite
  
  toggleGeoref() {
    this.isGeorefActive = !this.isGeorefActive;
    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
    } else {
      this.mapService.removeAllGcpLayersFromMap();
    }
  }
}
