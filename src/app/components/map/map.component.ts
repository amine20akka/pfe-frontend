import { AfterViewInit, Component, OnInit } from '@angular/core';
import { MapService } from '../../services/map.service';
import { CommonModule } from '@angular/common';
import { DrawService } from '../../services/draw.service';
import { LayerService } from '../../services/layer.service';
import { GeorefService } from '../../services/georef.service';
import { MockLayer } from '../../interfaces/mock-layer';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, fromEvent } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { FeatureEditSidebarComponent } from '../feature-edit-sidebar/feature-edit-sidebar.component';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    FeatureEditSidebarComponent,
  ],
})
export class MapComponent implements OnInit, AfterViewInit {

  isMapSelection = false;
  isDrawing = false;
  cursorX = 0;
  cursorY = 0;

  constructor(
    private mapService: MapService,
    private layerService: LayerService,
    private drawService: DrawService,
    private georefService: GeorefService,
  ) { }

  ngOnInit(): void {
    this.mapService.initMap('map');
    this.mapService.addWfsLayers();
    this.layerService.mockLayers$.subscribe((mockLayers: MockLayer[]) => {
      mockLayers.forEach((mockLayer: MockLayer) => {
        this.mapService.addLayerToMap(mockLayer.wfsLayer);
      })
    });
    this.layerService.mapLayers$.subscribe(() => {
      if (this.georefService.isGeorefActive) {
        this.mapService.syncMapLayers();
      }
    });

    this.layerService.georefLayers$.subscribe((georefLayers) => {
      georefLayers.forEach((georefLayer) => {
        if (georefLayer.layer) {
          this.mapService.addLayerToMap(georefLayer.layer);
        }
      })
    })

    this.mapService.isMapSelection$.subscribe(value => {
      this.isMapSelection = value;
    });

    this.mapService.mapCoordinates$.subscribe(coords => {
      this.cursorX = coords.x;
      this.cursorY = coords.y;
    });
    
    this.drawService.isDrawing$.subscribe(isDrawing => {
      this.isDrawing = isDrawing;
    });

    this.drawService.sidebarVisible$.subscribe((visible: boolean) => {
      if (!visible) {
        this.mapService.deactivateDrawInteractions();
      }
    });
  }

  ngAfterViewInit(): void {
    fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => {
        if (this.mapService.mapExists()) {
          this.mapService.updateSize();
        }
      });
  }
}