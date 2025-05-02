import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, EMPTY, filter, Observable, switchMap, take, throwError } from 'rxjs';
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
  ) {}

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
      compressionType: uploadResponse.compression,
      transformationType: uploadResponse.transformationType,
      outputFilename: uploadResponse.outputFilename
    }

    return {
      id: uploadResponse.id,
      imageFile: file,
      originalFilename: uploadResponse.filepathOriginal,
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

    this.georefImage$.pipe(
      filter((image) => image.status === GeorefStatus.UPLOADED),
      take(1),
      switchMap(() => this.renderImage(file))
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.isImageLoaded = true;
      },
      error: (err) => {
        this.notifService.showError("Erreur lors du rendu de l'image : " + err);
        this.resetLoadingState();
      }
    });
  }

  renderImage(file: File): Observable<void> {
    return new Observable<void>((observer) => {
      this.imageFileService.setImageFile(file);
      const img = new Image();

      img.onload = () => {
        const imageWidth = img.width;
        const imageHeight = img.height;

        this.imageFileService.setImageDimensions(imageWidth, imageHeight);
        this.imageFileService.setNewExtent([0, 0, imageWidth, imageHeight]);

        const previousUrl = this.imageFileService.getPreviousImageUrl();
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }

        this.isLoading = false;
        this.isImageLoaded = true;

        observer.next();
        observer.complete();
      };

      const currentUrl = this.imageFileService.getImageUrl();
      if (currentUrl) {
        img.src = currentUrl;
      } else {
        observer.error(new Error('No current image URL'));
      }
    });
  }

  private initialiseImage(file: File): void {
    this.imageApiService.uploadImage(file).subscribe({
      next: (uploadResponse: UploadResponse) => {
        if (uploadResponse) {
          const newGeorefImage = this.createGeorefImage(file, uploadResponse);
          this.updateGeorefImage(newGeorefImage);
          localStorage.setItem('imageId', uploadResponse.id);
          console.log('Image uploaded successfully:', newGeorefImage);
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

  updateTotalRMSE(newValue: number | undefined): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.totalRMSE = newValue;
    this.georefImageSubject.next(currentImage);
  }

  updateGeorefDate(lastGeorefDate: Date): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.lastGeoreferencingDate = lastGeorefDate;
    this.georefImageSubject.next(currentImage);
  }

  updateGeorefSettings(newSettings: GeorefSettings): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.settings = newSettings;
    this.georefImageSubject.next(currentImage);
  }

  updateGeorefImage(image: GeorefImage): void {
    this.georefImageSubject.next(image);
  }

  restoreImage(imageId: string): Observable<void> {
    return this.imageApiService.loadUploadedImage(imageId).pipe(
      switchMap((blob: Blob) => {
        if (!blob) {
          this.notifService.showError("Aucune image trouvée pour afficher !");
          return throwError(() => new Error('Blob vide'));
        }

        this.isLoading = true;

        return this.imageApiService.getGeorefImageById(imageId).pipe(
          switchMap((georefImageDto: GeorefImageDto) => {
            const restoredImageFile = new File([blob], georefImageDto.filepathOriginal, { type: blob.type });

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
              outputFilename: georefImageDto.outputFilename
            };
            
            this.updateGeorefImage(restoredImage);

            return this.renderImage(restoredImageFile);
          })
        );
      }),
      catchError(() => {
        this.isLoading = false;
        this.isImageLoaded = false;
        return EMPTY;
      })
    );
  }
}
