import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UploadResponse } from '../dto/upload-response';
import { NotificationService } from './notification.service';
import { ImageApiService } from './image-api.service';
import { LayerService } from './layer.service';
import { GeorefImage } from '../models/georef-image.model';
import { GeorefStatus } from '../enums/georef-status';
import { ImageFileService } from './image-file.service';
import { GeorefImageDto } from '../dto/georef-image-dto';
import { GeorefSettings } from '../interfaces/georef-settings';
import { SRID } from '../enums/srid';
import { ResamplingMethod } from '../enums/resampling-method';
import { TransformationType } from '../enums/transformation-type';
import { CompressionType } from '../enums/compression-type';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  isDragging = false;
  isLoading = false;
  isImageLoaded = false;
  private georefImageSubject = new BehaviorSubject<GeorefImage>({} as GeorefImage);
  georefImage$ = this.georefImageSubject.asObservable();

  constructor(
    private notifService: NotificationService,
    private imageFileService: ImageFileService,
    private imageApiService: ImageApiService,
    private layerService: LayerService,
  ) {
    // this.gcpService.totalRMSE$.subscribe((value) => {
    //   this.updateTotalRMSE(value);
    // })
  }

  resetImage(): void {
    this.imageApiService.deleteGeorefImageById(this.georefImageSubject.getValue().id).subscribe({
      next: () => {
        this.resetLoadingState();
        this.imageFileService.clear();
        this.layerService.resetImage();
        this.imageFileService.cursorCoordinates.next({ x: 0, y: 0 });
        this.georefImageSubject.next({} as GeorefImage);
        this.notifService.showSuccess("Image supprimée avec succès !");
        localStorage.removeItem('imageId');
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Image introuvable !");
        }
      }
    })
  }

  resetLoadingState(): void {
    this.isLoading = false;
    this.isImageLoaded = false;
  }

  createGeorefImage(file: File, uploadResponse: UploadResponse): GeorefImage {
    const defaultSettings: GeorefSettings = {
      transformationType: TransformationType.POLYNOMIAL_1,
      srid: SRID.WEB_MERCATOR,
      resamplingMethod: ResamplingMethod.NEAREST,
      compressionType: CompressionType.NONE,
    }
    
    const georefSettingsFromUploadResponse: GeorefSettings = {
      srid: uploadResponse.srid,
      resamplingMethod: uploadResponse.resamplingMethod,
      compressionType: uploadResponse.compressionType,
      transformationType: uploadResponse.transformationType,
      outputFilename: uploadResponse.outputFilename
    }

    return {
      id: uploadResponse.id,
      imageFile: file,
      filenameOriginal: uploadResponse.filepathOriginal,
      status: uploadResponse.status,
      uploadingDate: new Date(uploadResponse.uploadingDate),
      settings: georefSettingsFromUploadResponse.srid ? georefSettingsFromUploadResponse : defaultSettings,
    };
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

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.isLoading = true;
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.isLoading = true;
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    if (!this.imageFileService.validateFile(file)) {
      this.resetLoadingState();
      return;
    }

    this.initialiseImage(file);
    this.georefImage$.subscribe((image) => {
      if (image.status === GeorefStatus.UPLOADED) {
        this.renderImage(file);
      }
    });
  }

  private renderImage(file: File): void {
    this.imageFileService.setImageFile(file);
    const img = new Image();

    img.onload = () => {
      const imageWidth = img.width;
      const imageHeight = img.height;

      this.imageFileService.setImageDimensions(imageWidth, imageHeight);
      this.imageFileService.setNewExtent([0, 0, imageWidth, imageHeight]);
      setTimeout(() => {
        this.isLoading = false;
        this.isImageLoaded = true;
      }, 200);
    };

    if (this.imageFileService.getImageUrl()) {
      img.src = this.imageFileService.getImageUrl()!;
    }
  }

  private initialiseImage(file: File): void {
    this.imageApiService.uploadImage(file).subscribe({
      next: (uploadResponse: UploadResponse) => {
        if (uploadResponse) {
          const newGeorefImage = this.createGeorefImage(file, uploadResponse);
          this.updateGeorefStatus(GeorefStatus.UPLOADED);
          this.georefImageSubject.next(newGeorefImage);
          localStorage.setItem('imageId', uploadResponse.id);
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

  getGeorefImage(): GeorefImage {
    return this.georefImageSubject.getValue();
  }

  clearGeorefImage(): void {
    this.georefImageSubject.next({} as GeorefImage);
  }

  updateGeorefStatus(status: GeorefStatus): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.status = status;
    this.georefImageSubject.next(currentImage);
  }

  updateTotalRMSE(newValue: number): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.totalRMSE = newValue;
    this.georefImageSubject.next(currentImage);
  }

  updateGeorefDate(lastGeorefDate: Date): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.lastGeoreferencingDate = lastGeorefDate;
    this.georefImageSubject.next(currentImage);
  }

  updateGeorefImage(image: GeorefImage): void {
    this.georefImageSubject.next(image);
  }

  restoreImage(imageId: string): void {
    this.imageApiService.loadUploadedImage(imageId).subscribe({
      next: (blob: Blob) => {
        if (blob) {
          this.isLoading = true;
          this.imageApiService.getGeorefImageById(imageId).subscribe({
            next: (georefImageDto: GeorefImageDto) => {
              const restoredImageFile = new File([blob], georefImageDto.filepathOriginal, { type: blob.type });
              this.renderImage(restoredImageFile);

              const restoredImage = this.createGeorefImage(restoredImageFile, {
                id: georefImageDto.id,
                filepathOriginal: georefImageDto.filepathOriginal,
                status: georefImageDto.status,
                uploadingDate: georefImageDto.uploadingDate,
              });
              restoredImage.settings = {
                transformationType: georefImageDto.transformationType,
                srid: georefImageDto.srid,
                resamplingMethod: georefImageDto.resamplingMethod,
                compressionType: georefImageDto.compression,
              };
              this.georefImageSubject.next(restoredImage);
            },
            error: (err) => {
              if (err.status === 404) {
                this.notifService.showError("Aucune image trouvée pour afficher !");
              }
            }
          });
        }
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Aucune image trouvée pour afficher !");
        }
        this.isLoading = false;
        this.isImageLoaded = false;
      }
    });
  }
}
