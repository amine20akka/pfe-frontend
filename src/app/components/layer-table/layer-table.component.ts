import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { MatListModule } from '@angular/material/list';
import { MapService } from '../../services/map.service';
import TileLayer from 'ol/layer/Tile';
import { GeorefService } from '../../services/georef.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { WMSLayer } from '../../interfaces/wms-layer';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

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
  wmsLayers: WMSLayer[] = [];

  constructor(
    private mapService: MapService,
    private georefService: GeorefService,
  ) { }

  ngOnInit(): void {
    this.mapService.georefLayers$.subscribe((georefLayers) => {
      this.wmsLayers = georefLayers;
    });
  }

  get isTableActive(): boolean {
    return this.georefService.isTableActive;
  }

  toggleLayerVisibility(layer: TileLayer): void {
    this.mapService.toggleLayerVisibility(layer);
  }

  zoomToLayer(wmsLayer: WMSLayer): void {
    const extent = wmsLayer.layer.getExtent();
    console.log(extent);
    if (extent) {
      this.mapService.getMap()!.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] });
    }
  }

  showLayerDetails(layer: TileLayer): void {
    console.log('Détails de la couche:', layer);
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
