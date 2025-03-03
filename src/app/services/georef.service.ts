import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { ImageService } from './image.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GeorefRequestData } from '../interfaces/georef-request-data';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private http: HttpClient
  ) {}

  private apiUrl = 'http://localhost:8080/georeference'; // URL du backend

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

  georeferenceImage(requestData: GeorefRequestData): Observable<GeorefRequestData> {
    return this.http.post<GeorefRequestData>(this.apiUrl, requestData);
  }
}
