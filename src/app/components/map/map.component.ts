import { Component, OnInit } from '@angular/core';
import { MapService } from '../../services/map.service';
import { CommonModule } from '@angular/common';
import { DrawService } from '../../services/draw.service';
import { LayerService } from '../../services/layer.service';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  imports: [CommonModule],
})
export class MapComponent implements OnInit {
  isMapSelection = false;
  isDrawing = false;
  activeDrawTool: string | null = null;
  cursorX = 0;
  cursorY = 0;

  constructor(
    private mapService: MapService,
    private layerService: LayerService,
    private drawService: DrawService,
  ) { }

  ngOnInit(): void {
    this.mapService.initMap('map');
    this.layerService.mapLayers$.subscribe(() => {
      this.mapService.syncMapLayers();
    });

    this.layerService.georefLayers$.subscribe((georefLayers) => {
      georefLayers.forEach((georefLayer) => {
        this.mapService.addLayerToMap(georefLayer.layer);
      })
    })

    this.mapService.isMapSelection$.subscribe(value => {
      this.isMapSelection = value;
    });

    // S'abonner aux coordonnées du curseur
    this.mapService.mapCoordinates$.subscribe(coords => {
      this.cursorX = coords.x;
      this.cursorY = coords.y;
    });

    this.drawService.drawedLayers$.subscribe(drawedLayers => {
      drawedLayers.forEach(drawedLayer => {
        this.mapService.addLayerToMap(drawedLayer);
      });
    });

    this.drawService.isDrawing$.subscribe(isDrawing => {
      this.isDrawing = isDrawing;
    });

    this.drawService.activeDrawTool$.subscribe(activeDrawTool => {
      this.activeDrawTool = activeDrawTool;
    });
  }
}