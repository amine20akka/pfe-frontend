import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { ImageService } from './image.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeorefRequestData } from '../interfaces/georef-request-data';
import { GeorefStatus } from '../interfaces/georef-image';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private http: HttpClient
  ) { }

  private apiUrl = 'http://localhost:5000'; // URL du backend

  isGeorefActive = false; // Gère l'affichage de la partie droite
  isTableActive = false; // Gère la TDM

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

  toggleTable(): void {
    this.isTableActive = !this.isTableActive;
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
