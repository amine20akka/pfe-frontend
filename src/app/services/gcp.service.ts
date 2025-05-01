import { Injectable } from '@angular/core';
import { GCP } from '../models/gcp.model';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';
import { NotificationService } from './notification.service';
import { FromDto, FromDtos, GcpDto } from '../dto/gcp-dto';
import { GcpApiService } from './gcp-api.service';
import { SRID } from '../enums/srid';
import { TransformationType } from '../enums/transformation-type';
import { AddGcpRequest } from '../dto/add-gcp-request';
import { LayerService } from './layer.service';
import { ImageService } from './image.service';
import { Observable } from 'rxjs';
import { ResidualsResponse } from '../dto/resiudal-dtos';

@Injectable({
  providedIn: 'root'
})
export class GcpService {

  private gcps: GCP[] = [];
  private gcpsSubject = new BehaviorSubject<GCP[]>(this.gcps);
  private isFloatingSubject = new BehaviorSubject<boolean>(false);
  private isNearOriginalPositionSubject = new BehaviorSubject<boolean>(false);
  private transformationType!: TransformationType;
  private srid!: SRID;
  private currentImageId!: string;

  gcps$ = this.gcpsSubject.asObservable();
  isAddingGCP = false;
  isFloating$ = this.isFloatingSubject.asObservable();
  isNearOriginalPosition$ = this.isNearOriginalPositionSubject.asObservable();
  loadingGCPs = false;

  constructor(
    private notifService: NotificationService,
    private layerService: LayerService,
    private imageService: ImageService,
    private gcpApiService: GcpApiService
  ) {
    this.imageService.georefImage$.subscribe((image) => {
      if (image.settings) {
        this.srid = image.settings.srid ? image.settings.srid : SRID.WEB_MERCATOR;
        this.transformationType = image.settings.transformationType ? image.settings.transformationType : TransformationType.POLYNOMIAL_1;
      }
      if (image.id) {
        this.currentImageId = image.id;
      }
    })
  }

  createGCP(index: number, sourceX: number, sourceY: number, mapX: number, mapY: number, imageId: string, id?: string): GcpDto {
    const newGCP: GcpDto = {
      id: id,
      index: index,
      imageId: imageId,
      sourceX: sourceX,
      sourceY: sourceY,
      mapX: mapX,
      mapY: mapY,
    };

    return newGCP;
  }

  createAddGcpRequest(imageId: string, sourceX: number, sourceY: number, mapX: number, mapY: number): AddGcpRequest {
    const addGcpRequest: AddGcpRequest = {
      imageId: imageId,
      sourceX: sourceX,
      sourceY: sourceY,
      mapX: mapX,
      mapY: mapY,
    };

    return addGcpRequest;
  }

  addGcp(imageId: string, sourceX: number, sourceY: number, mapX: number, mapY: number): Observable<GcpDto | null> {
    const addGcpRequest = this.createAddGcpRequest(imageId, sourceX, sourceY, mapX, mapY);

    return this.gcpApiService.addGcp(addGcpRequest).pipe(
      map((savedGcp: GcpDto) => {
        if (savedGcp.mapX === null || savedGcp.mapY === null) {
          return null;
        }

        const newGcpDto = this.createGCP(
          savedGcp.index,
          savedGcp.sourceX,
          savedGcp.sourceY,
          savedGcp.mapX!,
          savedGcp.mapY!,
          savedGcp.imageId,
          savedGcp.id
        );

        this.addGcpToList(FromDto(savedGcp));
        return newGcpDto;
      }),
      catchError((err) => {
        if (err.status === 409) {
          this.notifService.showError("Un point existe déjà avec cet index !");
        } else if (err.status === 404) {
          this.notifService.showError("Image non trouvée ! Veuillez importer une image d'abord.");
        } else if (err.status === 400) {
          this.notifService.showError("Erreur de validation des données !");
        }
        return of(null);
      })
    );
  }

  getGCPs(): GCP[] {
    return this.gcpsSubject.getValue();
  }

  clearGCPs(): void {
    this.gcps = [];
    this.gcpsSubject.next(this.gcps);
  }

  toggleAddingGcp(): void {
    this.isAddingGCP = !this.isAddingGCP;
  }

  addGcpToList(gcp: GCP): void {
    this.gcps.push(gcp);
    this.gcpsSubject.next(this.gcps);
    this.updateResiduals(this.currentImageId);
  }

  deleteGcpData(gcpId: string): void {
    this.gcpApiService.deleteGcpById(gcpId).subscribe({
      next: (updatedGcps: GcpDto[]) => {
        if (updatedGcps.length > 0) {
          this.updateResiduals(this.currentImageId);
        }
        this.gcps = FromDtos(updatedGcps);
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Point introuvable !");
        }
      }
    })

    setTimeout(() => {
      this.gcpsSubject.next(this.gcps)
    }, 300);
  }

  updateGcp(gcpToUpdate: GCP): void {
    this.gcpApiService.updateGcp(gcpToUpdate).subscribe({
      next: (updatedGcpDto: GcpDto) => {
        if (updatedGcpDto) {
          const indexToUpdate = this.gcps.findIndex(gcp => gcp.id === updatedGcpDto.id);

          if (indexToUpdate !== -1) {
            const updatedGcp = FromDto(updatedGcpDto);
            this.gcps[indexToUpdate] = updatedGcp;
            this.gcpsSubject.next([...this.gcps]);

            this.layerService.updateImageGcpPosition(updatedGcp.index, updatedGcp.sourceX, updatedGcp.sourceY);
            this.layerService.updateMapGcpPosition(updatedGcp.index, updatedGcp.mapX!, updatedGcp.mapY!);

            this.updateResiduals(this.currentImageId);
          }
        }
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Point introuvable !");
        } else if (err.status === 400) {
          this.notifService.showError("Erreur de validation des données du point !");
        }
      }
    });
  }

  clearResiduals(): void {
    this.gcps.forEach(gcp => gcp.residual = undefined);
    this.gcpsSubject.next(this.gcps);
    this.imageService.updateTotalRMSE(undefined);
  }

  updateResiduals(imageId: string): void {
    this.gcpApiService.computeResiduals(imageId, this.transformationType, this.srid)
      .subscribe((response: ResidualsResponse) => {
        if (response.success) {
          this.gcps.forEach(gcp => {
            const gcpDto = response.gcpDtos.find((gcpDto: GcpDto) => gcpDto.id === gcp.id);
            if (gcpDto) {
              gcp.residual = gcpDto.residual;
            }
          });

          this.imageService.updateTotalRMSE(response.rmse);
        } else {
          this.clearResiduals();
          return;
        }
      });
  }

  updateFloatingStatus(status: boolean): void {
    this.isFloatingSubject.next(status);
  }

  updateNearOriginalPositionStatus(status: boolean): void {
    this.isNearOriginalPositionSubject.next(status);
  }

  async saveGCPs(): Promise<void> {
    if (this.gcps.length === 0) {
      this.notifService.showError("Aucun point n'est encore défini");
      return;
    }

    const simplifiedGcps = this.gcps.map(gcp => ({
      sourceX: gcp.sourceX,
      sourceY: gcp.sourceY,
      mapX: gcp.mapX,
      mapY: gcp.mapY
    }));

    const gcpData = JSON.stringify(simplifiedGcps, null, 2);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: 'gcps.json',
        types: [
          {
            description: 'Fichier JSON',
            accept: { 'application/json': ['.json'] }
          }
        ]
      });

      const writableStream = await fileHandle.createWritable();
      await writableStream.write(gcpData);
      await writableStream.close();
      this.notifService.showSuccess("Les points ont été enregistrés avec succès !");
    } catch (error) {
      this.notifService.showError("Erreur lors de l'enregistrement des points !");
      console.error('Erreur lors de l\'enregistrement des points: ', error);
    }
  }

  // async loadGCPs(event: Event): Promise<GCP[]> {
  // const input = event.target as HTMLInputElement;
  // if (input.files && input.files.length > 0) {
  //   const file = input.files[0];
  //   const reader = new FileReader();

  //   return new Promise<GCP[]>((resolve, reject) => {
  //     reader.onload = () => {
  //       try {
  //         this.updateLoadingGCPs(true);

  //         const simplifiedGcps = JSON.parse(reader.result as string);

  //         const gcps: GCP[] = [];

  //         const currentLength = this.gcps.length;

  //         // Transformer chaque point simplifié en utilisant createGCP
  //         simplifiedGcps.forEach((simplifiedGcp: { id: string, imageId:string, sourceX: number, sourceY: number, mapX: number, mapY: number }) => {
  //           // Nous devons modifier temporairement this.gcps.length pour que les index soient corrects
  //           this.gcps.length = gcps.length + currentLength;
  //           const newGCP = this.createGCP(simplifiedGcp.sourceX, simplifiedGcp.sourceY, simplifiedGcp.mapX, simplifiedGcp.mapY, this.currentImageId, simplifiedGcp.id);
  //           gcps.push(FromDto(newGCP));
  //         });

  //         // Restaurer la longueur d'origine
  //         this.gcps.length = currentLength;

  //         console.log('Les GCPs chargés : ', gcps);
  //         resolve(gcps);
  //       } catch (error) {
  //         console.error('Erreur de parsing JSON', error);
  //         reject([]);
  //       }
  //     };

  //     reader.onerror = () => {
  //       console.error('Erreur de lecture du fichier');
  //       reject([]);
  //     };

  //     reader.readAsText(file);
  //   });
  // }
  //   return [];
  // }

  updateLoadingGCPs(status: boolean): void {
    this.loadingGCPs = status;
  }

  // addGCPs(gcps: GCP[]): void {
  //   const updatedGcps = [...this.gcps, ...gcps];
  //   this.gcps = updatedGcps;
  //   this.gcpsSubject.next(this.gcps);
  //   this.updateResiduals(this.currentImageId);
  // }

  getGcpsByImageId(imageId: string): Observable<GcpDto[]> {
    return this.gcpApiService.getGcpsByImageId(imageId).pipe(
      tap((response: GcpDto[]) => {
        if (response) {
          response.map((gcpDto: GcpDto) => {
            const gcp = this.createGCP(gcpDto.index, gcpDto.sourceX, gcpDto.sourceY, gcpDto.mapX!, gcpDto.mapY!, imageId, gcpDto.id);
            this.addGcpToList(FromDto(gcp));
          });
        }
      }),
      catchError((err) => {
        if (err.status === 404) {
          this.notifService.showError("Image non trouvée !");
        }
        throw err;
      })
    );
  }

  restoreGcpLayers(gcpDtos: GcpDto[]): void {
    if (gcpDtos) {
      gcpDtos.forEach((gcpDto: GcpDto) => {
        const newGcpImageLayer = this.layerService.createGcpImageLayer(gcpDto.sourceX, gcpDto.sourceY);
        this.layerService.addGcpImageLayerToList(newGcpImageLayer);
        if (gcpDto.mapX && gcpDto.mapY) {
          const newGcpMapLayer = this.layerService.createGcpMapLayer(gcpDto.mapX, gcpDto.mapY);
          this.layerService.addGcpMapLayerToList(newGcpMapLayer);
        }
      });
    }
  }
}