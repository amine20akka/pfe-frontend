import { Component } from '@angular/core';
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
import { CompressionType, GeorefSettings, ResamplingMethod, SRID, TransformationType } from '../../models/georef-settings';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from '../../models/confirm-dialog-data';
import { GeorefSettingsService } from '../../services/georef-settings.service';
import { GeorefRequestData } from '../../models/georef-request-data';
import { GeorefImage, GeorefStatus } from '../../models/georef-image';
import { GeoserverService } from '../../services/geoserver.service';
import { NotificationService } from '../../services/notification.service';

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

  isMapSelection = false;
  georefSuccess = false;

  private georefSettings: GeorefSettings = {
    transformationType: TransformationType.POLYNOMIAL_1,
    srid: SRID.WEB_MERCATOR,
    resamplingMethod: ResamplingMethod.NEAREST,
    compressionType: CompressionType.NONE,
    outputFilename: ''
  };
  private georefImage!: GeorefImage;

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService,
    private gcpService: GcpService,
    private mapService: MapService,
    private georefSettingsService: GeorefSettingsService,
    private geoserverService: GeoserverService,
    private dialog: MatDialog,
    private notifService: NotificationService, 
  ) {
    this.georefSettingsService.settings$.subscribe((settings) => {
      if (settings.outputFilename) {
        this.georefSettings = settings
        this.georefImage.settings = settings
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
    this.imageService.clearAllGcpLayers();
    this.mapService.clearAllGcpLayers();
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

    dialogRef.afterClosed().subscribe((result: GeorefSettings) => {
      if (result) {
        this.georefSettingsService.updateSettings(result);
        this.gcpService.updateResiduals();
        console.log('Paramètres de géoréférencement mis à jour:', result);
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
        console.log('Action confirmée');
        this.reset();
      } else {
        console.log('Action annulée');
      }
    });
  }

  openClearConfirmDialog(): void {
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
        console.log('Action confirmée');
        this.clearGCPs();
      } else {
        console.log('Action annulée');
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

    const requestData: GeorefRequestData = {
      settings: {
        transformationType: this.georefSettings.transformationType,
        srid: this.georefSettings.srid,
        resamplingMethod: this.georefSettings.resamplingMethod,
        compressionType: this.georefSettings.compressionType,
        outputFilename: this.georefSettings.outputFilename
      },
      gcps: gcpData,
      imageFile: this.georefImage.imageFile  // Ajoutez le fichier à la requête
    };

    this.georefService.georeferenceImage(requestData).subscribe({
      next: (responselayerName) => {
        setTimeout(() => {
          this.georefImage.wmsLayer = this.geoserverService.createWMSLayer(responselayerName);
          this.imageService.updateGeorefStatus(GeorefStatus.COMPLETED);
          this.georefSuccess = true;
          this.imageService.updateGeorefDate(new Date(Date.now()));
          this.mapService.addGeorefLayertoList(this.georefImage.wmsLayer);
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
