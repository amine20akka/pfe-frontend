import { Injectable } from '@angular/core';
import { GcpService } from './gcp.service';
import { BehaviorSubject } from 'rxjs';
import { UploadResponse } from '../dto/upload-response';
import { NotificationService } from './notification.service';
import { ImageApiService } from './image-api.service';
import { GeorefSettingsService } from './georef-settings.service';
import { FromDto, GcpDto } from '../dto/gcp-dto';
import { GcpApiService } from './gcp-api.service';
import { LayerService } from './layer.service';
import { GeorefImage } from '../models/georef-image.model';
import { GeorefStatus } from '../enums/georef-status';
import { TransformationType } from '../enums/transformation-type';
import { CompressionType } from '../enums/compression-type';
import { ResamplingMethod } from '../enums/resampling-method';
import { SRID } from '../enums/srid';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private georefImageSubject = new BehaviorSubject<GeorefImage>({} as GeorefImage);
  georefImage$ = this.georefImageSubject.asObservable();
  isDragging = false;
  isImageLoaded = false;
  isLoading = false;

  constructor(
    private gcpService: GcpService,
    private notifService: NotificationService,
    private imageApiService: ImageApiService,
    private gcpApiService: GcpApiService,
    private georefSettingsService: GeorefSettingsService,
    private layerService: LayerService,
  ) {
    this.gcpService.totalRMSE$.subscribe((value) => {
      this.updateTotalRMSE(value);
    })
  }

  resetImage(): void {
    this.imageApiService.deleteGeorefImageById(this.georefImageSubject.getValue().id).subscribe({
      next: () => {
        this.isImageLoaded = false;
        localStorage.setItem("isImageLoaded", JSON.stringify(this.isImageLoaded));
        this.layerService.setImageWidth(0);
        this.layerService.setImageHeight(0);
        this.layerService.resetImage();
        this.gcpService.cursorCoordinates.next({ x: 0, y: 0 });
        this.gcpService.clearGCPs()
        this.layerService.clearAllGcpImageLayers();
        this.georefImageSubject.next({} as GeorefImage);
        this.georefSettingsService.resetSettings();
        localStorage.removeItem("GeorefImage");
        localStorage.removeItem("cachedImage");
        this.notifService.showSuccess("Image supprimée avec succès !");
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Image introuvable !");
        }
      }
    })
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    this.isLoading = true;

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.isLoading = true; // Afficher immédiatement le spinner
      this.handleFile(input.files[0]);
    }
  }

  private validateFile(file: File): boolean {
    const MAX_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.notifService.showError("Format d'image non supporté");
      this.resetLoadingState();
      return false;
    }

    if (file.size > MAX_SIZE) {
      this.notifService.showError('Fichier trop volumineux (max 10 Mo)');
      this.resetLoadingState();
      return false;
    }

    return true;
  }

  private handleFile(file: File): void {
    if (!this.validateFile(file)) return;

    this.isImageLoaded = false;
    localStorage.setItem("isImageLoaded", JSON.stringify(this.isImageLoaded));
    this.initialiseImage(file);
    this.georefImage$.subscribe((image) => {
      if (image.status === GeorefStatus.UPLOADED) {
        this.renderImage(file);
        if (this.layerService.getCurrentImageUrl()) {
          URL.revokeObjectURL(this.layerService.getCurrentImageUrl());
        }
      }
    });
  }

  private initialiseImage(file: File): void {
    this.imageApiService.uploadImage(file).subscribe({
      next: (uploadResponse: UploadResponse) => {
        if (uploadResponse) {
          const newGeorefImage = this.createGeorefImage(file, uploadResponse);
          this.updateGeorefStatus(GeorefStatus.UPLOADED);
          this.georefImageSubject.next(newGeorefImage);
          localStorage.setItem("GeorefImage", JSON.stringify(newGeorefImage));
          this.imageApiService.updateGeorefParams(uploadResponse.id, newGeorefImage.settings).subscribe({
            error: (err) => {
              if (err.status === 404) {
                this.notifService.showError("Image introuvable !");
              }
            }
          })
        }
      },
      error: (err) => {
        this.resetLoadingState();
        if (err.status === 415) {
          this.notifService.showError("Format d'image non supporté");
        }
        return;
      }
    });
  }

  private renderImage(file: File): void {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const imageWidth = img.width;
      const imageHeight = img.height;

      const startTime = Date.now();
      const minLoadingTime = 1000; // Minimum d’attente visuelle

      const finishLoading = () => {
        this.isLoading = false;
        this.isImageLoaded = true;
        localStorage.setItem("isImageLoaded", JSON.stringify(this.isImageLoaded));
        this.layerService.setNewImageUrl(imageUrl);
        this.layerService.setImageWidth(imageWidth);
        this.layerService.setImageHeight(imageHeight);
        this.layerService.setNewExtent([0, 0, imageWidth, imageHeight]);
        this.cacheImage(file, imageWidth, imageHeight);
      };

      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minLoadingTime) {
        setTimeout(finishLoading, minLoadingTime - elapsedTime);
      } else {
        finishLoading();
      }
    };
    img.src = imageUrl;
  }

  private cacheImage(file: File, width: number, height: number): void {
    const reader = new FileReader();
    reader.onload = () => {
      const cache = {
        imageUrl: reader.result as string,
        width,
        height,
        timestamp: Date.now()
      };
      localStorage.setItem('cachedImage', JSON.stringify(cache));
    };
    reader.readAsDataURL(file);
  }

  restoreCachedImage(): void {
    const cached = localStorage.getItem('cachedImage');
    if (!cached) return;

    const { imageUrl, width, height, timestamp } = JSON.parse(cached);
    const expiration = 30 * 60 * 1000;

    if (Date.now() - timestamp > expiration) {
      localStorage.removeItem('cachedImage');
      return;
    }

    const img = new Image();
    img.onload = () => {
      this.layerService.setNewImageUrl(imageUrl);
      this.layerService.setImageWidth(width);
      this.layerService.setImageHeight(height);
      this.layerService.setNewExtent([0, 0, width, height]);
      this.isImageLoaded = true;
      localStorage.setItem("isImageLoaded", JSON.stringify(this.isImageLoaded));
      const georefImage = localStorage.getItem("GeorefImage");
      if (georefImage) {
        const parsedGeorefImage: GeorefImage = JSON.parse(georefImage);
        this.georefImageSubject.next(parsedGeorefImage);
      }
      this.isLoading = false;
      this.addGcpsByImageId(this.georefImageSubject.getValue().id);
    };
    img.src = imageUrl;
  }

  private resetLoadingState(): void {
    this.isLoading = false;
    this.isImageLoaded = false;
    localStorage.setItem("isImageLoaded", JSON.stringify(this.isImageLoaded));
  }

  createGeorefImage(file: File, uploadResponse: UploadResponse): GeorefImage {
    return {
      id: uploadResponse.id,
      imageFile: file,
      filenameOriginal: uploadResponse.filepathOriginal,
      status: uploadResponse.status,
      uploadingDate: new Date(Date.now()),
      settings: {
        srid: SRID.WEB_MERCATOR,
        resamplingMethod: ResamplingMethod.NEAREST,
        compressionType: CompressionType.NONE,
        transformationType: TransformationType.POLYNOMIAL_1,
        outputFilename: '.tif'
      }
    };
  }

  getGeorefImage(): GeorefImage {
    return this.georefImageSubject.getValue();
  }

  clearGeorefImage(): void {
    this.georefImageSubject.next({} as GeorefImage);
    localStorage.removeItem("GeorefImage");
  }

  updateGeorefStatus(status: GeorefStatus): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.status = status;
    this.georefImageSubject.next(currentImage);
    localStorage.setItem("GeorefImage", JSON.stringify(currentImage));
  }

  updateTotalRMSE(newValue: number): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.totalRMSE = newValue;
    this.georefImageSubject.next(currentImage);
    if (currentImage.totalRMSE > 0) {
      localStorage.setItem("GeorefImage", JSON.stringify(currentImage));
    }
  }

  updateGeorefDate(lastGeorefDate: Date): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.lastGeoreferencingDate = lastGeorefDate;
    this.georefImageSubject.next(currentImage);
    localStorage.setItem("GeorefImage", JSON.stringify(currentImage));
  }

  addGcpsByImageId(imageId: string): void {
    this.gcpApiService.getGcpsByImageId(imageId).subscribe({
      next: (response: GcpDto[]) => {
        response.map((gcpDto: GcpDto) => {
          const gcp = this.gcpService.createGCP(gcpDto.sourceX, gcpDto.sourceY, gcpDto.mapX!, gcpDto.mapY!, imageId, gcpDto.id);
          this.gcpService.addGcpToList(FromDto(gcp));
          const newGcpImageLayer = this.layerService.createGcpImageLayer(gcp.sourceX, gcp.sourceY + this.layerService.imageHeight);
          this.layerService.addGcpImageLayerToList(newGcpImageLayer);
          if (gcp.mapX && gcp.mapY) {
            const newGcpMapLayer = this.layerService.createGcpMapLayer(gcp.mapX, gcp.mapY);
            this.layerService.addGcpMapLayerToList(newGcpMapLayer);
          }
        });

      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Image non trouvée !");
        }
      }
    });
  }
}
