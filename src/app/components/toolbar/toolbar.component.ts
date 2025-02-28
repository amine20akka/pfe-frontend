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
import { CompressionType, ResamplingMethod, SRID, TransformationType } from '../../interfaces/georef-settings';

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
  srid: SRID = SRID.WGS84;
  resamplingMethod: ResamplingMethod = ResamplingMethod.BILINEAR;
  compression: CompressionType = CompressionType.LZW;

  constructor(
    private georefService: GeorefService, 
    private imageService: ImageService, 
    private gcpService: GcpService,
    private mapService: MapService,
    private dialog: MatDialog,
  ) { }

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
        transformation_type: this.transformationType || 'polynomial 1',
        srid: this.srid || 4326,
        resampling_method: this.resamplingMethod || 'bilinear',
        compression: this.compression || 'LZW'
      }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.transformationType = result.transformation_type;
        this.srid = result.srid;
        this.resamplingMethod = result.resampling_method;
        this.compression = result.compression;
        console.log('Paramètres de géoréférencement mis à jour:', result);
      }
    });
  }
}
