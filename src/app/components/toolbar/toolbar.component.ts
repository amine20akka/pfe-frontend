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
import { NotificationService } from '../../services/notification.service';
import { LayerService } from '../../services/layer.service';
import { GeorefRequest } from '../../dto/georef-request';
import { GeorefSettings } from '../../interfaces/georef-settings';
import { GeorefLayer } from '../../models/georef-layer.model';

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
  private overwritePending = false;
  private regeorefImageId = "";
  private georefLayerToDelete!: GeorefLayer;

  private georefImage!: GeorefImage;

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService,
    private gcpService: GcpService,
    private mapService: MapService,
    private layerService: LayerService,
    private georefSettingsService: GeorefSettingsService,
    private dialog: MatDialog,
    private notifService: NotificationService,
  ) {
    this.imageService.georefImage$.subscribe((image) => {
      this.georefImage = image;
    });

    this.mapService.isMapSelection$.subscribe(value => this.isMapSelection = value);

    this.georefService.regeorefImageId$.subscribe(value => this.regeorefImageId = value);
    this.georefService.GeorefLayerToDelete$.subscribe(value => this.georefLayerToDelete = value);
  }

  get isAddingGCP(): boolean {
    return this.gcpService.isAddingGCP;
  }

  get isReGeoref(): boolean {
    return this.georefService.isReGeoref;
  }

  toggleGeoref(): void {
    this.georefService.toggleGeoref();
  }

  toggleAddingGCP(): void {
    this.gcpService.toggleAddingGcp();
  }

  reset(): void {
    this.gcpService.clearLayerAndDataMaps();
    this.imageService.resetImage(this.isReGeoref);
    this.georefService.isReGeoref = false;
  }

  clearGCPs(): void {
    this.gcpService.clearGCPs(this.georefImage.id);
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
        this.overwritePending = !!result;
        this.fileInput.nativeElement.value = '';
        this.fileInput.nativeElement.click();
      });
    } else {
      this.overwritePending = true;
      this.fileInput.nativeElement.value = '';
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: Event): void {
    this.gcpService.updateLoadingGCPs(true);
    const overwrite = this.overwritePending;

    if (overwrite && this.gcpService.getGCPs().length > 0) {
      this.gcpService.clearLayerAndDataMaps();
    }

    setTimeout(() => {
      this.gcpService.loadGCPs(event, this.georefImage.id, overwrite)
        .then((gcps) => {
          if (gcps && gcps.length > 0) {
            this.gcpService.addGCPs(gcps);
            this.layerService.loadGcpImageLayers(gcps);
            this.layerService.loadGcpMapLayers(gcps);
          }
        })
        .catch(() => {
          this.gcpService.updateLoadingGCPs(false);
        })
        .finally(() => {
          this.gcpService.updateResiduals(this.georefImage.id);
          this.gcpService.updateLoadingGCPs(false);
        });
    }, 300);
  }

  openGeorefSettings(): void {
    const dialogRef = this.dialog.open(GeorefSettingsDialogComponent, {
      data: {
        transformationType: this.georefImage.settings.transformationType,
        srid: this.georefImage.settings.srid,
        resamplingMethod: this.georefImage.settings.resamplingMethod,
        compressionType: this.georefImage.settings.compressionType,
        outputFilename: this.georefImage.settings.outputFilename
      },
      disableClose: true,
      panelClass: 'custom-dialog'
    });

    dialogRef.afterClosed().subscribe((newSettings: GeorefSettings) => {
      if (newSettings) {
        this.georefSettingsService.updateGeorefParams(this.georefImage.id, newSettings);
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
        this.gcpService.updateLoadingGCPs(true);
        this.clearGCPs();
      }
    });
  }

  openGeorefConfirmDialog(): void {
    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous prêt de géoréférencer cette  image?',
      confirmText: 'Géoréférencer',
      cancelText: 'Annuler',
      icon: 'pin_drop'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.georeferenceImage();
      }
    });
  }

  georeferenceImage(): void {
    const gcpData = this.gcpService.getGCPs();
    const georefRequest: GeorefRequest = {
      georefSettings: {
        transformationType: this.georefImage.settings.transformationType,
        srid: this.georefImage.settings.srid,
        resamplingMethod: this.georefImage.settings.resamplingMethod,
        compressionType: this.georefImage.settings.compressionType,
        outputFilename: this.georefImage.settings.outputFilename
      },
      gcps: gcpData
    };

    if (!this.isReGeoref || !this.georefLayerToDelete || !this.regeorefImageId) {

      this.georefService.georeferenceImage(georefRequest, this.georefImage.id);
    
    } else {
      this.georefService.clearGeorefLayerAndRegeorefImage(this.georefImage.id, this.georefLayerToDelete)
        .subscribe({
          next: () => {
            setTimeout(() => {
              this.georefService.georeferenceImage(georefRequest, this.regeorefImageId);
              this.gcpService.updateResiduals(this.regeorefImageId);
              this.georefService.isReGeoref = false;
            }, 500);
          }
        });
    }
  }
}
