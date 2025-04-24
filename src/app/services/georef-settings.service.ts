import { Injectable } from '@angular/core';
import { GeorefSettings } from '../interfaces/georef-settings';
import { NotificationService } from './notification.service';
import { ImageService } from './image.service';
import { ImageApiService } from './image-api.service';
import { GeorefImageDto } from '../dto/georef-image-dto';

@Injectable({
  providedIn: 'root'
})
export class GeorefSettingsService {

  constructor(
    private imageApiService: ImageApiService,
    private imageService: ImageService,
    private notifService: NotificationService,
  ) { }

  updateGeorefParams(imageId: string, newSettings: GeorefSettings): void {
    this.imageApiService.updateGeorefParams(imageId, newSettings).subscribe({
      next: (updatedGeorefImageDto: GeorefImageDto) => {
        const newSettings: GeorefSettings = {
          srid: updatedGeorefImageDto.srid,
          transformationType: updatedGeorefImageDto.transformationType,
          resamplingMethod: updatedGeorefImageDto.resamplingMethod,
          compressionType: updatedGeorefImageDto.compression,
          outputFilename: updatedGeorefImageDto.outputFilename
        }
        this.imageService.updateGeorefSettings(newSettings);
        this.notifService.showSuccess("Paramètres de géoréférencement mis à jour avec succès !");
      },
      error: (error) => {
        if (error.status === 400) {
          this.notifService.showError("Erreur lors de la mise à jour des paramètres de géoréférencement !");
        }
      }
    });
  }
}