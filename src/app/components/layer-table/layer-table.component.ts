import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { MatListModule } from '@angular/material/list';
import { MapService } from '../../services/map.service';
import { GeorefService } from '../../services/georef.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog-data';
import { LayerService } from '../../services/layer.service';
import { GeorefLayer } from '../../models/georef-layer.model';
import { ImageApiService } from '../../services/image-api.service';
import { GeorefImageDto } from '../../dto/georef-image-dto';
import { LayerDetailsComponent } from '../layer-details/layer-details.component';
import { ImageService } from '../../services/image.service';
import { GcpService } from '../../services/gcp.service';
import { GcpDto } from '../../dto/gcp-dto';
import { switchMap, tap, catchError, EMPTY } from 'rxjs';
import { GeorefApiService } from '../../services/georef-api.service';

@Component({
  selector: 'app-layer-table',
  imports: [
    MatDialogModule,
    CommonModule,
    MatCheckboxModule,
    MatSliderModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    FormsModule,
    MatTabsModule,
  ],
  templateUrl: './layer-table.component.html',
  styleUrls: ['./layer-table.component.scss'],
  animations: [
    trigger('slideInOut', [
      state('hidden', style({ width: '0', opacity: 0 })),
      state('visible', style({ width: '28%', opacity: 1 })),
      transition('* => *', animate('500ms ease-in-out')),
    ])
  ]
})
export class LayerTableComponent implements OnInit {

  georeflayers: GeorefLayer[] = [];
  isVisible = false;

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private gcpService: GcpService,
    private georefService: GeorefService,
    private georefApiService: GeorefApiService,
    private layerService: LayerService,
    private imageApiService: ImageApiService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.georefApiService.getAllGeorefLayers().subscribe({
      next: (georefLayers: GeorefLayer[]) => {
        this.layerService.createWMSLayersAndAddToList(georefLayers).subscribe();
      }
    })

    this.layerService.georefLayers$.subscribe((georeflayers) => {
      this.georeflayers = georeflayers;
    })
  }

  get isTableActive(): boolean {
    return this.georefService.isTableActive;
  }

  get isReGeoref() : boolean {
    return this.georefService.isReGeoref;
  }

  toggleContent(): void {
    this.isVisible = !this.isVisible;
  }

  toggleLayerVisibility(georeflayer: GeorefLayer): void {
    this.mapService.toggleLayerVisibility(georeflayer.layer!);
  }

  zoomToLayer(georeflayer: GeorefLayer): void {
    const extent = georeflayer.layer!.getExtent();
    if (extent) {
      this.mapService.getMap()!.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] });
    }
  }

  showLayerDetails(imageId: string): void {
    this.imageApiService.getGeorefImageById(imageId).subscribe({
      next: (georefImageDto: GeorefImageDto) => {
        if (georefImageDto.id) {
          this.dialog.open(LayerDetailsComponent, {
            data: { geoImage: georefImageDto },
            panelClass: 'custom-dialog',
            autoFocus: false
          });
        }
      }
    });
  }

  updateOpacity(georeflayer: GeorefLayer): void {
    if (georeflayer.layer) {
      georeflayer.layer.setOpacity(georeflayer.opacity!);
    }
  }

  removeGeorefLayerAndImage(georeflayer: GeorefLayer): void {
    this.mapService.removeGeorefLayerAndImageFromMap(georeflayer);
  }

  openDeleteConfirmDialog(georefLayer: GeorefLayer): void {
    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous sûr de supprimer définitivement cette image géoréférencée ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      icon: 'delete'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.removeGeorefLayerAndImage(georefLayer);
      }
    });
  }

  openReGeorefImageDialog(georefLayer: GeorefLayer): void {
    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous sûr de refaire le géoréférencement de cette image ?',
      confirmText: 'Refaire',
      cancelText: 'Annuler',
      icon: 'refresh'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ReGeorefImage(georefLayer);
      }
    });
  }

  ReGeorefImage(georefLayer: GeorefLayer): void {
    this.georefService.isReGeoref = true;
    georefLayer.layer!.setVisible(false);
    this.georefService.toggleTable();
    this.georefService.toggleGeoref();

    this.imageService.restoreImage(georefLayer.imageId).pipe(
      switchMap(() => this.gcpService.getGcpsByImageId(georefLayer.imageId)),
      tap((gcpDtos: GcpDto[]) => {
        setTimeout(() => {
          this.gcpService.restoreGcpLayers(gcpDtos);
        }, 500);
      }),
      catchError((err) => {
        console.error('Erreur lors de la restauration ou de l\'ajout des GCPs', err);
        return EMPTY;
      })
    ).subscribe();
  }
}
