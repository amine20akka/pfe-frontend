import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GcpDto } from '../dto/gcp-dto';
import { Observable } from 'rxjs';
import { AddGcpRequest } from '../dto/add-gcp-request';
import { GCP } from '../models/gcp.model';

@Injectable({
  providedIn: 'root'
})
export class GcpApiService {

  private apiUrl = 'http://localhost:8081/georef/gcp';

  constructor(private http: HttpClient) { }

  addGcp(newGcp: AddGcpRequest): Observable<GcpDto> {
    return this.http.post<GcpDto>(`${this.apiUrl}/add`, newGcp);
  }

  getGcpsByImageId(imageId: string): Observable<GcpDto[]> {
    return this.http.get<GcpDto[]>(`${this.apiUrl}/get/${imageId}`);
  }

  deleteGcpById(gcpId: string): Observable<GcpDto[]> {
    return this.http.delete<GcpDto[]>(`${this.apiUrl}/delete/${gcpId}`);
  }

  updateGcp(gcp: GCP): Observable<GcpDto> {
    return this.http.put<GcpDto>(`${this.apiUrl}/update`, gcp);
  }
}
