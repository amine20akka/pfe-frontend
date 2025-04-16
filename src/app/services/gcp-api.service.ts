import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GcpDto } from '../dto/gcp-dto';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GcpApiService {

  private apiUrl = 'http://localhost:8081';

  constructor(private http: HttpClient) { }

  addGcp(gcp: GcpDto): Observable<GcpDto> {
    return this.http.post<GcpDto>(`${this.apiUrl}/georef/gcp/add`, gcp);
  }

  getGcpsByImageId(imageId: string): Observable<GcpDto[]> {
    return this.http.get<GcpDto[]>(`${this.apiUrl}/georef/gcp/get/${imageId}`);
  }
}
