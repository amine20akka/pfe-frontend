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
import { CompressionType, GeorefSettings, ResamplingMethod, SRID, TransformationType } from '../../interfaces/georef-settings';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from '../../interfaces/confirm-dialog-data';
import { GeorefSettingsService } from '../../services/georef-settings.service';
import { GeorefRequestData } from '../../interfaces/georef-request-data';
import { GeorefImage, GeorefStatus } from '../../interfaces/georef-image';

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

  transformationType: TransformationType = TransformationType.POLYNOMIAL_1;
  srid: SRID = SRID.WEB_MERCATOR;
  resamplingMethod: ResamplingMethod = ResamplingMethod.NEAREST;
  compressionType: CompressionType = CompressionType.NONE;
  outputFilename = '';
  private georefImage!: GeorefImage;

  constructor(
    private georefService: GeorefService, 
    private imageService: ImageService, 
    private gcpService: GcpService,
    private mapService: MapService,
    private georefSettingsService: GeorefSettingsService,
    private dialog: MatDialog,
  ) { 
    this.georefSettingsService.transformationType$.subscribe((type) => {
      this.transformationType = type;
    })
    this.georefSettingsService.srid$.subscribe((srid) => {
      this.srid = srid;
    })
    this.georefSettingsService.resamplingMethod$.subscribe((method) => {
      this.resamplingMethod = method;
    })
    this.georefSettingsService.compressionType$.subscribe((type) => {
      this.compressionType = type;
    })
    this.georefSettingsService.outputFilename$.subscribe((filename) => {
      if (filename) {
        this.outputFilename = filename;
        this.georefImage.filenameGeoreferenced = filename;
      }
    })
    this.imageService.georefImage$.subscribe((image) => {
      this.georefImage = image;
    })
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
    this.imageService.resetImage();
    this.mapService.clearAllGcpLayers();
  }

  clearGCPs(): void {
    this.gcpService.clearGCPs();
    this.imageService.clearAllGcpLayers();
    this.mapService.clearAllGcpLayers();
  }

  openGeorefSettings(): void {
    const dialogRef = this.dialog.open(GeorefSettingsDialogComponent, {
      data: {
        transformationType: this.transformationType,
        srid: this.srid,
        resamplingMethod: this.resamplingMethod,
        compressionType: this.compressionType,
        outputFilename: this.outputFilename
      }
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
      width: '400px',
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
      icon: 'delete'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
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
    const gcpData = this.gcpService.getGCPs();
    
    const requestData: GeorefRequestData = {
      settings: {
        transformationType: this.transformationType,
        srid: this.srid,
        resamplingMethod: this.resamplingMethod,
        compressionType: this.compressionType,
        outputFilename: this.outputFilename
      },
      gcps: gcpData,
      imageFile: this.georefImage.imageFile  // Ajoutez le fichier à la requête
    };
  
    // Mettez à jour le statut
    this.imageService.updateGeorefStatus(GeorefStatus.PROCESSING);
    
    this.georefService.georeferenceImage(requestData).subscribe({
      next: (response) => {
        // Convertir le Blob en File
        this.georefImage.resultFilePath = URL.createObjectURL(response);
        const file = new File([response], this.georefImage.filenameGeoreferenced!.concat('.tiff'), {
          type: 'image/tiff'
        });
        
        this.georefImage.outputFile = file;
        this.imageService.updateGeorefStatus(GeorefStatus.COMPLETED);
    
        // Récupérer les métadonnées
        this.georefService.getGeoTiffMetadata(this.georefImage.filenameGeoreferenced!).subscribe({
          next: (response) => {
            if (response.metadata) {
              this.mapService.addGeoreferencedImageToMap(this.georefImage.resultFilePath!, response.metadata);
            }
          }
        });
     
        console.log('Géoréférencement terminé avec succès !', this.georefImage);
      },
      error: (error) => {
        console.error('Erreur lors du géoréférencement', error);
      }
    });
  }
}
