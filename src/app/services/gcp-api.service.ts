import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GcpDto } from '../dto/gcp-dto';
import { Observable } from 'rxjs';
import { AddGcpRequest } from '../dto/add-gcp-request';
import { GCP } from '../models/gcp.model';
import { TransformationType } from '../enums/transformation-type';
import { ResidualsRequest, ResidualsResponse } from '../dto/resiudal-dtos';
import { LoadGcpsRequest } from '../dto/load-gcps-request';

@Injectable({
  providedIn: 'root'
})
export class GcpApiService {

  private apiUrl = 'http://localhost:8081/georef/gcp';

  constructor(private http: HttpClient) { }

  addGcp(newGcp: AddGcpRequest): Observable<GcpDto> {
    return this.http.post<GcpDto>(`${this.apiUrl}/`, newGcp);
  }

  getGcpsByImageId(imageId: string): Observable<GcpDto[]> {
    return this.http.get<GcpDto[]>(`${this.apiUrl}/${imageId}`);
  }

  deleteGcpById(gcpId: string): Observable<GcpDto[]> {
    return this.http.delete<GcpDto[]>(`${this.apiUrl}/${gcpId}`);
  }

  updateGcp(gcp: GCP): Observable<GcpDto> {
    return this.http.put<GcpDto>(`${this.apiUrl}/`, gcp);
  }

  computeResiduals(imageId: string, transformationType: TransformationType, srid: number): Observable<ResidualsResponse> {
    const requestBody: ResidualsRequest = { 
                  imageId: imageId, 
                  type: transformationType, 
                  srid: srid 
                };
    return this.http.put<ResidualsResponse>(`${this.apiUrl}/residuals`, requestBody);
  }

  addGcps(imageId: string, gcpDtos: GcpDto[], overwrite: boolean): Observable<GcpDto[]> {
    const loadGcpsRequest: LoadGcpsRequest = {
      imageId: imageId,
      gcps: gcpDtos,
      overwrite: overwrite
    }
    return this.http.post<GcpDto[]>(`${this.apiUrl}/load`, loadGcpsRequest);
  }
}
