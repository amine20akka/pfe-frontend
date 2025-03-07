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
import { LayerDetailsComponent } from '../layer-details/layer-details.component';
import { ImageService } from '../../services/image.service';
import { GeorefImage } from '../../interfaces/georef-image';
import { WMSLayer } from '../../interfaces/wms-layer';

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
  
  georefImage!: GeorefImage;
  wmsLayers: WMSLayer[] = [];

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private georefService: GeorefService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.imageService.georefImage$.subscribe((georefImage) => {
      if (georefImage.wmsLayer?.layerName) {
        this.georefImage = georefImage;
      }
    });
    this.mapService.georefLayers$.subscribe((georeflayers) => {
      this.wmsLayers = georeflayers;
    })
  }

  get isTableActive(): boolean {
    return this.georefService.isTableActive;
  }

  toggleLayerVisibility(wmsLayer: WMSLayer): void {
    this.mapService.toggleLayerVisibility(wmsLayer.layer);
  }

  zoomToLayer(wmsLayer: WMSLayer): void {
    const extent = wmsLayer.layer.getExtent();
    if (extent) {
      this.mapService.getMap()!.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] });
    }
  }

  showLayerDetails(): void {
    // Ouvrir la boîte de dialogue avec les données
    this.dialog.open(LayerDetailsComponent, {
      data: { geoImage: this.georefImage },
      panelClass: 'custom-dialog',
      autoFocus: false
    });
  }

  updateOpacity(wmslayer: WMSLayer): void {
    if (wmslayer.layer) {
      wmslayer.layer.setOpacity(wmslayer.opacity);
    }
  }

  removeLayer(layer: WMSLayer): void {
    this.mapService.deleteGeorefLayer(layer);
  }

}
