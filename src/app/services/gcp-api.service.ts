import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GcpDto } from '../dto/gcp-dto';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GcpApiService {

  private apiUrl = 'http://localhost:8081/georef/gcp';

  constructor(private http: HttpClient) { }

  addGcp(gcp: GcpDto): Observable<GcpDto> {
    return this.http.post<GcpDto>(`${this.apiUrl}/add`, gcp);
  }

  getGcpsByImageId(imageId: string): Observable<GcpDto[]> {
    return this.http.get<GcpDto[]>(`${this.apiUrl}/get/${imageId}`);
  }
}
