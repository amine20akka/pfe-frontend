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
      this.outputFilename = filename;
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
      width: '500px',
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
    const gcpData = this.gcpService.getGCPs(); // Récupère les GCPs
    const requestData = {
      transformationType: this.transformationType,
      srid: this.srid,
      resamplingMethod: this.resamplingMethod,
      compressionType: this.compressionType,
      outputFilename: this.outputFilename,
      gcps: gcpData
    };
  
    this.georefService.georeferenceImage(requestData).subscribe(
      (response) => {
        console.log('Géoréférencement terminé avec succès !', response);
        // TODO: Afficher le résultat sur la carte
      },
      (error) => {
        console.error('Erreur lors du géoréférencement', error);
      }
    );
  }  
}
