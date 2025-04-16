import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { filter, map, Observable } from 'rxjs';
import { UploadResponse } from '../dto/upload-response';

@Injectable({
  providedIn: 'root'
})
export class ImageApiService {

  private apiUrl = 'http://localhost:8081';

  constructor(private http: HttpClient) { }

  uploadImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UploadResponse>(`${this.apiUrl}/georef/images/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      filter(event => event.type === HttpEventType.Response),
      map(event => event.body as UploadResponse)
    );
  }
}
