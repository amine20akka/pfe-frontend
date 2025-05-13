import { Injectable } from '@angular/core';
import { GeorefRequest } from '../dto/georef-request';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { GeorefResponse } from '../dto/georef-response';
import { GeorefLayer } from '../models/georef-layer.model';

@Injectable({
  providedIn: 'root'
})
export class GeorefApiService {

  private apiUrl = 'http://localhost:8081/georef/layer';

    constructor(
      private http: HttpClient
    ) {}

  georeferenceImage(georefRequest: GeorefRequest, imageId: string): Observable<GeorefResponse> {
    return this.http.post<GeorefResponse>(`${this.apiUrl}/${imageId}`, georefRequest);
  }

  deleteGeorefLayerById(georefLayerId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${georefLayerId}`);
  }

  deleteGeorefLayerAndImageById(georefLayerId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/layer-and-image/${georefLayerId}`);
  }

  getAllGeorefLayers(): Observable<GeorefLayer[]> {
    return this.http.get<GeorefLayer[]>(`${this.apiUrl}`);
  }
}
