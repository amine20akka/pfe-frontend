import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { filter, map, Observable } from 'rxjs';
import { UploadResponse } from '../dto/upload-response';
import { GeorefSettings } from '../interfaces/georef-settings';
import { GeorefImageDto } from '../dto/georef-image-dto';
import { TransformationMapping, SridMapping, ResamplingMapping, CompressionMapping } from '../dto/settings-mapping';

@Injectable({
  providedIn: 'root'
})
export class ImageApiService {

  private apiUrl = 'http://localhost:8081/georef/image';

  constructor(private http: HttpClient) { }

  uploadImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      filter(event => event.type === HttpEventType.Response),
      map(event => event.body as UploadResponse)
    );
  }

  updateGeorefParams(imageId: string, settings: GeorefSettings): Observable<GeorefImageDto> {
    const requestPayload = {
      id: imageId,
      transformationType: TransformationMapping[settings.transformationType],
      srid: SridMapping[settings.srid],
      resamplingMethod: ResamplingMapping[settings.resamplingMethod],
      compression: CompressionMapping[settings.compressionType]
    };
    return this.http.put<GeorefImageDto>(`${this.apiUrl}/georef-params`, requestPayload);
  }
}
