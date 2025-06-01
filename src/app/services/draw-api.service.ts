import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LayerSchema } from '../dto/layer-schema';
import { FeatureUpdateRequest } from '../dto/feature-update-request';
import { FeatureUpdateResult } from '../dto/feature-update-result';

@Injectable({
  providedIn: 'root'
})
export class DrawApiService {

  private apiUrl = 'http://localhost:8082/drawing/layers';

  constructor(private http: HttpClient) { }

  getLayerSchema(layerId: string): Observable<LayerSchema> {
    return this.http.get<LayerSchema>(`${this.apiUrl}/${layerId}/schema`);
  }

  updateFeature(updateRequest: FeatureUpdateRequest, featureId: string | number, layerId: string): Observable<FeatureUpdateResult> {
    return this.http.put<FeatureUpdateResult>(`${this.apiUrl}/${layerId}/${featureId}/update`, updateRequest);
  }

  deleteFeature(featureId: string | number, layerId: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.apiUrl}/${layerId}/${featureId}/delete`);
  }

  insertFeature(insertRequest: FeatureUpdateRequest, layerId: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/${layerId}/insert`, insertRequest);
  }
}
