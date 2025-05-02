import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { ImageService } from './image.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DrawService } from './draw.service';
import { LayerService } from './layer.service';
import { GeorefStatus } from '../enums/georef-status';
import { GeorefRequest } from '../dto/georef-request';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private layerService: LayerService,
    private drawService: DrawService,
    private http: HttpClient
  ) {
    const saved = localStorage.getItem('isGeorefActive');
    this.isGeorefActive = saved ? JSON.parse(saved) : false;

    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.layerService.syncImageLayers();
      }, 500);
    }

    this.imageService.georefImage$.subscribe((georefImage) => {
      if (georefImage.status === GeorefStatus.PROCESSING) this.isProcessing = true;
      if (georefImage.status === GeorefStatus.COMPLETED) this.isProcessing = false;
      if (georefImage.status === GeorefStatus.FAILED) this.isProcessing = false;
    })
  }

  private gdalApiUrl = 'http://localhost:5000';

  isGeorefActive = false;
  isTableActive = false;
  isDrawToolsActive = false;
  isProcessing = false;
  panelWidth = 47; // Largeur par défaut

  toggleGeoref() {
    if (this.isDrawToolsActive && !this.isGeorefActive) {
      this.toggleDrawTools();
    }

    this.isGeorefActive = !this.isGeorefActive;
    localStorage.setItem('isGeorefActive', JSON.stringify(this.isGeorefActive));

    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.layerService.syncImageLayers();
      }, 300);
    } else {
      this.mapService.removeAllGcpLayersFromMap();
    }
  }

  toggleTable() {
    if (this.isDrawToolsActive && !this.isTableActive) {
      this.toggleDrawTools();
    }
    this.isTableActive = !this.isTableActive;
  }

  toggleDrawTools() {
    this.isDrawToolsActive = !this.isDrawToolsActive;
    
    if (this.isDrawToolsActive && this.isGeorefActive) {
      this.toggleGeoref();
    }

    if (this.isDrawToolsActive && this.isTableActive) {
      this.toggleTable();
    }

    if (!this.isDrawToolsActive) {
      this.drawService.stopDrawing();
    }
  }

  updatePanelWidth(newWidth: number): void {
    this.panelWidth = newWidth;
  }

  georeferenceImage(requestData: GeorefRequest): Observable<string> {
    const formData = new FormData();

    // Ajoutez le fichier image s'il est disponible
    if (requestData.imageFile) {
      formData.append('image', requestData.imageFile);
    }

    // Convertissez les données JSON en chaîne pour FormData
    formData.append('settings', JSON.stringify(requestData.settings));
    formData.append('gcps', JSON.stringify(requestData.gcps));

    this.imageService.updateGeorefStatus(GeorefStatus.PROCESSING);

    return this.http.post(`${this.gdalApiUrl}/georef`, formData, { responseType: 'text' });
  }
}
