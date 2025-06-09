import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { LayerService } from './layer.service';
import { GeorefLayer } from '../models/georef-layer.model';
import { GeorefResponse } from '../dto/georef-response';
import { ImageService } from './image.service';
import { GeoserverService } from './geoserver.service';
import { GcpService } from './gcp.service';
import TileLayer from 'ol/layer/Tile';
import { Observable, switchMap, throwError, catchError, EMPTY, map, BehaviorSubject, tap } from 'rxjs';
import { GcpDto, FromDto } from '../dto/gcp-dto';
import { RegeorefResponse } from '../dto/regeoref-response';
import { ImageApiService } from './image-api.service';
import { NotificationService } from './notification.service';
import { GeorefApiService } from './georef-api.service';
import { GeorefRequest } from '../dto/georef-request';
import { LayerStatus } from '../enums/layer-status';
import { MockLayer } from '../interfaces/mock-layer';
@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private imageApiService: ImageApiService,
    private georefApiService: GeorefApiService,
    private notifService: NotificationService,
    private layerService: LayerService,
    private geoserverService: GeoserverService,
    private gcpService: GcpService,
  ) {
    const saved = localStorage.getItem('isGeorefActive');
    this.isGeorefActive = saved ? JSON.parse(saved) : false;

    const isTableActiveSaved = localStorage.getItem('isTableActive');
    this.isTableActive = isTableActiveSaved ? JSON.parse(isTableActiveSaved) : false;

    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.layerService.syncImageLayers();
      }, 500);
    }
  }

  private regeorefImageIdSubject = new BehaviorSubject<string>("");
  regeorefImageId$ = this.regeorefImageIdSubject.asObservable();
  private GeorefLayerToDeleteSubject = new BehaviorSubject<GeorefLayer>({} as GeorefLayer);
  GeorefLayerToDelete$ = this.GeorefLayerToDeleteSubject.asObservable();

  isGeorefActive = false;
  isTableActive = false;
  isReGeoref = false;
  isDrawPanelActive = false;
  isProcessing = false;
  panelWidth = 47; // Largeur par défaut

  toggleGeoref() {
    if (this.isDrawPanelActive && !this.isGeorefActive) {
      this.toggleDrawPanel(null);
    }

    this.isGeorefActive = !this.isGeorefActive;
    localStorage.setItem('isGeorefActive', JSON.stringify(this.isGeorefActive));

    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.layerService.syncImageLayers();
      }, 300);
    } else {
      this.mapService.removeAllGcpLayersFromMap();
    }
  }

  toggleTable() {
    if (this.isDrawPanelActive && !this.isTableActive) {
      this.toggleDrawPanel(null);
    }
    this.isTableActive = !this.isTableActive;
    localStorage.setItem('isTableActive', JSON.stringify(this.isTableActive));
  }

  toggleDrawPanel(mockLayer: MockLayer | null) {
    this.mapService.setEditLayer(mockLayer);
    this.isDrawPanelActive = !this.isDrawPanelActive;
    
    if (this.isDrawPanelActive && this.isGeorefActive) {
      this.toggleGeoref();
    }
    
    if (this.isDrawPanelActive && this.isTableActive) {
      this.toggleTable();
    }
    
    if (!this.isDrawPanelActive) {
      this.mapService.updateActiveEntityMode(null);
      this.mapService.dismissSelectSnackbar();
      this.mapService.disableSelectInteraction();
      this.mapService.deactivateDrawInteractions();
    }
  }

  updatePanelWidth(newWidth: number): void {
    this.panelWidth = newWidth;
  }

  updateRegeorefIds(newRegeorefImageId: string, newGeorefLayerToDelete: GeorefLayer): void {
    this.regeorefImageIdSubject.next(newRegeorefImageId);
    this.GeorefLayerToDeleteSubject.next(newGeorefLayerToDelete);
  }

  georeferenceImage(georefRequest: GeorefRequest, imageId: string): void {
    this.georefApiService.georeferenceImage(georefRequest, imageId).subscribe({
      next: (georefResponse: GeorefResponse) => {
        if (!georefResponse.enoughGCPs) {
          this.notifService.showError(georefResponse.message);
          return;
        } else {

          this.isProcessing = true;

          setTimeout(() => {
            if (georefResponse.georefLayer.status == LayerStatus.PUBLISHED) {
              this.finishGeoref(georefResponse);
              this.toggleGeoref();
              this.notifService.showSuccess("Géoréférencement terminé avec succès !");
            }
          }, 400);
        }
      },
      error: (error) => {
        this.notifService.showError("Géoréférencement échouée !");
        console.error('Erreur lors du géoréférencement', error);
      }
    });
  }

  finishGeoref(georefResponse: GeorefResponse): void {
    this.gcpService.clearLayerAndDataMaps();

    const newGeorefLayer: GeorefLayer = georefResponse.georefLayer;

    this.geoserverService.createWMSLayer(newGeorefLayer.layerName, newGeorefLayer.wmsUrl, newGeorefLayer.workspace)
      .subscribe((layer: TileLayer) => {
        newGeorefLayer.layer = layer;
        newGeorefLayer.opacity = 1;

        this.layerService.addGeorefLayertoList(newGeorefLayer);
        this.imageService.clearImage();
        this.isProcessing = false;
      });

  }

  clearGeorefLayerAndRegeorefImage(regeorefImageId: string, georefLayerToDelete: GeorefLayer): Observable<void> {
    return this.imageApiService.deleteGeorefImageByIdWithoutFile(regeorefImageId).pipe(
      tap(() => this.mapService.deleteGeorefLayerFromMap(georefLayerToDelete))
    );
  }

  prepareRegeorefImage(imageId: string): Observable<void> {
    return this.imageApiService.loadUploadedImage(imageId).pipe(
      switchMap((blob: Blob) => {
        if (!blob) {
          this.notifService.showError("Aucune image trouvée pour afficher !");
          return throwError(() => new Error('Blob vide'));
        }

        this.imageService.isLoading = true;

        return this.georefApiService.prepareRegeorefImage(imageId).pipe(
          switchMap((regeorefResponse: RegeorefResponse) => {
            const restoredImageFile = new File([blob], regeorefResponse.georefImageDto.filepathOriginal, { type: blob.type });

            const restoredImage = this.imageService.createGeorefImage(restoredImageFile, {
              id: regeorefResponse.georefImageDto.id,
              filepathOriginal: regeorefResponse.georefImageDto.filepathOriginal,
              status: regeorefResponse.georefImageDto.status,
              uploadingDate: regeorefResponse.georefImageDto.uploadingDate,
            });

            restoredImage.settings = {
              transformationType: regeorefResponse.georefImageDto.transformationType,
              srid: regeorefResponse.georefImageDto.srid,
              resamplingMethod: regeorefResponse.georefImageDto.resamplingMethod,
              compressionType: regeorefResponse.georefImageDto.compression,
              outputFilename: regeorefResponse.georefImageDto.outputFilename
            };

            this.imageService.updateGeorefImage(restoredImage);

            return this.imageService.renderImage(restoredImageFile).pipe(
              map(() => {
                regeorefResponse.gcpDtos.forEach((gcpDto: GcpDto) => {
                  const gcp = this.gcpService.createGCP(gcpDto.index, gcpDto.sourceX, gcpDto.sourceY,
                    gcpDto.mapX!, gcpDto.mapY!, imageId, gcpDto.id);
                  this.gcpService.addGcpToList(FromDto(gcp));
                });
              }),
              map(() => {
                setTimeout(() => {
                  this.gcpService.restoreGcpLayers(regeorefResponse.gcpDtos);
                }, 600);
              })
            );
          })
        );
      }),
      catchError((error) => {
        this.notifService.showError("Erreur lors du chargement de l'image");
        console.error("Erreur de préparation de l'image:", error);
        this.imageService.isLoading = false;
        this.imageService.isImageLoaded = false;
        return EMPTY;
      })
    );
  }
}
