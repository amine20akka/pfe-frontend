import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { ImageService } from './image.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { GeorefRequestData } from '../interfaces/georef-request-data';
import { GeorefStatus } from '../interfaces/georef-image';
import { GeoTiffMetadata } from '../interfaces/geotiff-metadata';

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

  georeferenceImage(requestData: GeorefRequestData): Observable<Blob> {
    const formData = new FormData();

    // Ajoutez le fichier image s'il est disponible
    if (requestData.imageFile) {
      formData.append('image', requestData.imageFile);
    }
    console.log(requestData.imageFile);

    // Convertissez les données JSON en chaîne pour FormData
    formData.append('settings', JSON.stringify(requestData.settings));
    formData.append('gcps', JSON.stringify(requestData.gcps));

    this.imageService.updateGeorefStatus(GeorefStatus.PROCESSING);

    // Spécifiez que la réponse est un Blob (fichier binaire)
    return this.http.post(`${this.apiUrl}/georef`, formData, {
      responseType: 'blob'
    });
  }

  getGeoTiffMetadata(filename: string): Observable<GeoTiffMetadata> {
    // Utiliser HttpParams pour envoyer le nom du fichier
    const params = new HttpParams()
      .set('filename', filename);

    return this.http.get<GeoTiffMetadata>(`${this.apiUrl}/geotiff-metadata`, { 
      params: params 
    }).pipe(
      tap(response => {
        if (!response.success) {
          throw new Error(response.error || 'Erreur inconnue lors de la récupération des métadonnées');
        }
      }),
      map(response => response),
      catchError(error => {
        console.error('Erreur lors de la récupération des métadonnées', error);
        return throwError(() => new Error('Impossible de récupérer les métadonnées du GeoTIFF'));
      })
    );
  }
}
