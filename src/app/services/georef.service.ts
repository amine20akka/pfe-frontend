import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { ImageService } from './image.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeorefRequestData } from '../models/georef-request-data';
import { GeorefStatus } from '../models/georef-image';
import { DrawService } from './draw.service';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private drawService: DrawService,
    private http: HttpClient
  ) {
    this.imageService.georefImage$.subscribe((georefImage) => {
      if (georefImage.status === GeorefStatus.PROCESSING) this.isProcessing = true;
      if (georefImage.status === GeorefStatus.COMPLETED) this.isProcessing = false;
      if (georefImage.status === GeorefStatus.FAILED) this.isProcessing = false;
    })
  }

  private apiUrl = 'http://localhost:5000'; // URL du backend

  isGeorefActive = false; // Gère l'affichage de la partie droite
  isTableActive = false; // Gère la TDM
  isDrawToolsActive = false; // Gère les outils de dessin
  isProcessing = false;
  panelWidth = 47; // Largeur par défaut

  toggleGeoref() {
    if (this.isDrawToolsActive) {
      this.toggleDrawTools();
    }
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

  toggleTable() {
    this.isTableActive = !this.isTableActive;
    if (this.isDrawToolsActive) {
      this.toggleDrawTools();
    }
  }

  toggleDrawTools() {
    this.isDrawToolsActive = !this.isDrawToolsActive;
    if (this.isDrawToolsActive) {
      this.isGeorefActive = false;
      this.isTableActive = false;
    }

    if (!this.isDrawToolsActive) {
      this.drawService.stopDrawing();
    }
  }

  updatePanelWidth(newWidth: number): void {
    this.panelWidth = newWidth;
  }

  georeferenceImage(requestData: GeorefRequestData): Observable<string> {
    const formData = new FormData();

    // Ajoutez le fichier image s'il est disponible
    if (requestData.imageFile) {
      formData.append('image', requestData.imageFile);
    }

    // Convertissez les données JSON en chaîne pour FormData
    formData.append('settings', JSON.stringify(requestData.settings));
    formData.append('gcps', JSON.stringify(requestData.gcps));

    this.imageService.updateGeorefStatus(GeorefStatus.PROCESSING);

    return this.http.post(`${this.apiUrl}/georef`, formData, { responseType: 'text' });
  }
}
