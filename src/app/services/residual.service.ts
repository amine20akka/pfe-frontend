import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ResidualsRequest, ResidualsResponse } from '../dto/resiudal-dtos';
import { Observable } from 'rxjs';
import { GCP } from '../models/gcp.model';
import { TransformationType } from '../enums/transformation-type';

@Injectable({
  providedIn: 'root'
})
export class ResidualService {

  private apiUrl = 'http://localhost:5000'; // URL du backend

  constructor(private http: HttpClient) {}

  computeResiduals(gcps: GCP[], transformationType: TransformationType, srid: number): Observable<ResidualsResponse> {
    const requestBody: ResidualsRequest = { gcps, transformationType, srid };
    return this.http.post<ResidualsResponse>(`${this.apiUrl}/get-residuals`, requestBody);
  }
}
