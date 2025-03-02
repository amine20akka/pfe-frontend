import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { ImageService } from './image.service';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
  ) {}

  isGeorefActive = false; // Gère l'affichage de la partie droite
  
  toggleGeoref() {
    this.isGeorefActive = !this.isGeorefActive;
    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.imageService.syncImageLayers();
      }, 300)
    } else {
      this.mapService.removeAllGcpLayersFromMap();
    }
  }
}
