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
  ],
  templateUrl: './layer-table.component.html',
  styleUrls: ['./layer-table.component.scss'],
  animations: [
    trigger('slideInOut', [
      state('hidden', style({width: '0', opacity: 0})),
      state('visible', style({width: '15%', opacity: 1})),
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

  /**
   * Met à jour la visibilité d'une couche.
   * @param layer Couche cible
   */
  toggleLayerVisibility(layer: TileLayer): void {
    this.mapService.toggleLayerVisibility(layer);
  }

  /**
   * Met à jour l'opacité d'une couche.
   * @param layer Couche cible
   * @param event Événement du curseur
   */
  // updateLayerOpacity(layer: TileLayer, event: any): void {
  //   this.mapService.updateLayerOpacity(layer, event.value);
  // }
}
