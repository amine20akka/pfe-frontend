import { Component, ViewChild, ElementRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { GeorefService } from '../../services/georef.service';
import { ImageService } from '../../services/image.service';
import { GcpService } from '../../services/gcp.service';
import { MapService } from '../../services/map.service';
import { MatDialog } from '@angular/material/dialog';
import { GeorefSettingsDialogComponent } from '../georef-settings-dialog/georef-settings-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog-data';
import { GeorefSettingsService } from '../../services/georef-settings.service';
import { GeorefImage } from '../../models/georef-image.model';
import { GeoserverService } from '../../services/geoserver.service';
import { NotificationService } from '../../services/notification.service';
import { LayerService } from '../../services/layer.service';
import { GeorefRequest } from '../../dto/georef-request';
import { CompressionType } from '../../enums/compression-type';
import { GeorefStatus } from '../../enums/georef-status';
import { ResamplingMethod } from '../../enums/resampling-method';
import { SRID } from '../../enums/srid';
import { TransformationType } from '../../enums/transformation-type';
import { GeorefSettings } from '../../interfaces/georef-settings';
import { ImageApiService } from '../../services/image-api.service';
import { GeorefImageDto } from '../../dto/georef-image-dto';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatToolbarModule,
    MatDividerModule,
  ]
})
export class ToolbarComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isMapSelection = false;
  georefSuccess = false;
  clearAndLoad = false;

  private georefSettings: GeorefSettings = {
    transformationType: TransformationType.POLYNOMIAL_1,
    srid: SRID.WEB_MERCATOR,
    resamplingMethod: ResamplingMethod.NEAREST,
    compressionType: CompressionType.NONE,
    outputFilename: '.tif'
  };
  private georefImage!: GeorefImage;

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService,
    private imageApiService: ImageApiService,
    private gcpService: GcpService,
    private mapService: MapService,
    private layerService: LayerService,
    private georefSettingsService: GeorefSettingsService,
    private geoserverService: GeoserverService,
    private dialog: MatDialog,
    private notifService: NotificationService,
  ) {
    this.georefSettingsService.settings$.subscribe((settings) => {
      if (settings.outputFilename) {
        this.georefSettings = settings
        this.georefImage.settings = settings
        localStorage.setItem('GeorefImage', JSON.stringify(this.imageService.getGeorefImage()));
      }
    })
    this.imageService.georefImage$.subscribe((image) => {
      this.georefImage = image;
      if (!this.georefImage.settings.outputFilename) {
        const filenameParts = this.georefImage.filenameOriginal.split('.');
        const extension = filenameParts.pop();
        this.georefSettings.outputFilename = `${filenameParts.join('.')}_georef.${extension}`;
        this.georefSettingsService.updateSettings(this.georefSettings);
      }
    })

    this.mapService.isMapSelection$.subscribe(value => this.isMapSelection = value)
  }

  get isAddingGCP(): boolean {
    return this.gcpService.isAddingGCP;
  }

  toggleGeoref(): void {
    this.georefService.toggleGeoref();
  }

  toggleAddingGCP(): void {
    this.gcpService.toggleAddingGcp();
  }

  reset(): void {
    this.clearGCPs();
    this.imageService.resetImage();
  }

  clearGCPs(): void {
    this.gcpService.clearGCPs();
    this.layerService.clearAllGcpImageLayers();
    this.layerService.clearAllGcpMapLayers();
  }

  saveGCPs(): void {
    this.gcpService.saveGCPs();
  }

  openLoadConfirmDialog(): void {
    if (this.gcpService.getGCPs().length > 0) {
      const dialogData: ConfirmDialogData = {
        title: 'Voulez-vous écraser les points existants ?',
        confirmText: 'Oui',
        cancelText: 'Non',
        icon: 'warning'
      };

      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '350px',
        data: dialogData,
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.clearAndLoad = true;
        } else {
          this.clearAndLoad = false;
        }
        this.fileInput.nativeElement.click();
      });
    } else {
      this.fileInput.nativeElement.click();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadGCPs(event: Event): void {
    if (this.clearAndLoad) {
      this.clearGCPs();
    }
    // this.gcpService.loadGCPs(event).then((gcps) => {
    //   this.gcpService.addGCPs(gcps);
    //   this.layerService.loadImageLayers(gcps);
    //   this.layerService.loadMapLayers(gcps);
    //   this.gcpService.updateLoadingGCPs(false);
    // }).catch(() => {
    //   this.gcpService.updateLoadingGCPs(false);
    // });
  }

  openGeorefSettings(): void {
    const dialogRef = this.dialog.open(GeorefSettingsDialogComponent, {
      data: {
        transformationType: this.georefSettings.transformationType,
        srid: this.georefSettings.srid,
        resamplingMethod: this.georefSettings.resamplingMethod,
        compressionType: this.georefSettings.compressionType,
        outputFilename: this.georefSettings.outputFilename
      },
      disableClose: true,
      panelClass: 'custom-dialog'
    });

    dialogRef.afterClosed().subscribe((newSettings: GeorefSettings) => {
      if (newSettings) {
        this.georefSettingsService.updateSettings(newSettings);
        this.gcpService.updateResiduals();
        this.imageApiService.updateGeorefParams(this.georefImage.id, newSettings).subscribe({
          next: (updatedGeorefImage: GeorefImageDto) => {
            this.notifService.showSuccess("Paramètres de géoréférencement mis à jour avec succès !");
            console.log("Géoréférencement mis à jour avec succès", updatedGeorefImage);
          },
          error: (error) => {
            if (error.status === 400) {
              this.notifService.showError("Erreur lors de la mise à jour des paramètres de géoréférencement !");
            }
          }
        })
      }
    });
  }

  openResetConfirmDialog(): void {
    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous sûr de réinitialiser votre image importée ?',
      confirmText: 'Réinitialiser',
      cancelText: 'Annuler',
      icon: 'refresh'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.reset();
      }
    });
  }

  openClearConfirmDialog(): void {
    if (this.gcpService.getGCPs().length === 0) {
      this.notifService.showError("Aucun point n'est encore défini");
      return;
    }

    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous sûr de supprimer tous les points de contrôles ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      icon: 'delete_forever'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.clearGCPs();
      }
    });
  }

  georeferenceImage(): void {
    if (!this.gcpService.hasEnoughGCPs()) {
      let message = "";
      switch (this.georefSettings.transformationType) {
        case TransformationType.POLYNOMIAL_1:
          message = this.georefSettings.transformationType + " : Au moins 3 points de contrôle requis";
          break;
        case TransformationType.POLYNOMIAL_2:
          message = this.georefSettings.transformationType + " : Au moins 6 points de contrôle requis";
          break;
        case TransformationType.POLYNOMIAL_3:
          message = this.georefSettings.transformationType + " : Au moins 10 points de contrôle requis";
          break;
        default:
          break;
      }
      this.notifService.showError(message);
      return;
    }

    // Mettez à jour le statut
    this.imageService.updateGeorefStatus(GeorefStatus.PROCESSING);

    const gcpData = this.gcpService.getGCPs();

    const requestData: GeorefRequest = {
      settings: {
        transformationType: this.georefSettings.transformationType,
        srid: this.georefSettings.srid,
        resamplingMethod: this.georefSettings.resamplingMethod,
        compressionType: this.georefSettings.compressionType,
        outputFilename: this.georefSettings.outputFilename
      },
      gcps: gcpData,
      imageFile: this.georefImage.imageFile
    };

    this.georefService.georeferenceImage(requestData).subscribe({
      next: (responselayerName) => {
        setTimeout(() => {
          this.georefImage.wmsLayer = this.geoserverService.createWMSLayer(responselayerName);
          this.imageService.updateGeorefStatus(GeorefStatus.COMPLETED);
          this.georefSuccess = true;
          this.imageService.updateGeorefDate(new Date(Date.now()));
          this.layerService.addGeorefLayertoList(this.georefImage.wmsLayer);
          this.reset();
          this.georefService.toggleGeoref();
        }, 2000);
      },
      error: (error) => {
        this.notifService.showError("Géoréférencement échouée !");
        console.error('Erreur lors du géoréférencement', error);
        this.imageService.updateGeorefStatus(GeorefStatus.FAILED);
        this.georefSuccess = false;
        this.georefService.toggleGeoref();
      }
    });
    setTimeout(() => {
      if (this.georefSuccess) {
        this.imageService.updateGeorefStatus(GeorefStatus.PENDING);
        this.notifService.showSuccess("Géoréférencement terminé avec succès !");
      }
    }, 4000);
  }
}
