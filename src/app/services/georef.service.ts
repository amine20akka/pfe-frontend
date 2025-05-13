import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { DrawService } from './draw.service';
import { LayerService } from './layer.service';
import { GeorefLayer } from '../models/georef-layer.model';
import { GeorefResponse } from '../dto/georef-response';
import { ImageService } from './image.service';
import { GeoserverService } from './geoserver.service';
import { GcpService } from './gcp.service';
import TileLayer from 'ol/layer/Tile';
@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private layerService: LayerService,
    private geoserverService: GeoserverService,
    private gcpService: GcpService,
    private drawService: DrawService
  ) {
    const saved = localStorage.getItem('isGeorefActive');
    this.isGeorefActive = saved ? JSON.parse(saved) : false;

    const isTableActiveSaved = localStorage.getItem('isTableActive');
    this.isTableActive = isTableActiveSaved ? JSON.parse(isTableActiveSaved) : false;

    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.layerService.syncImageLayers();
      }, 500);
    }
  }

  isGeorefActive = false;
  isTableActive = false;
  isReGeoref = false;
  isDrawToolsActive = false;
  isProcessing = false;
  panelWidth = 47; // Largeur par défaut

  toggleGeoref() {
    if (this.isDrawToolsActive && !this.isGeorefActive) {
      this.toggleDrawTools();
    }

    this.isGeorefActive = !this.isGeorefActive;
    localStorage.setItem('isGeorefActive', JSON.stringify(this.isGeorefActive));

    if (this.isGeorefActive) {
      this.mapService.syncMapLayers();
      setTimeout(() => {
        this.layerService.syncImageLayers();
      }, 300);
    } else {
      this.mapService.removeAllGcpLayersFromMap();
    }
  }

  toggleTable() {
    if (this.isDrawToolsActive && !this.isTableActive) {
      this.toggleDrawTools();
    }
    this.isTableActive = !this.isTableActive;
    localStorage.setItem('isTableActive', JSON.stringify(this.isTableActive));
  }

  toggleDrawTools() {
    this.isDrawToolsActive = !this.isDrawToolsActive;

    if (this.isDrawToolsActive && this.isGeorefActive) {
      this.toggleGeoref();
    }

    if (this.isDrawToolsActive && this.isTableActive) {
      this.toggleTable();
    }

    if (!this.isDrawToolsActive) {
      this.drawService.stopDrawing();
    }
  }

  updatePanelWidth(newWidth: number): void {
    this.panelWidth = newWidth;
  }

  finishGeoref(georefResponse: GeorefResponse): void {
    this.gcpService.clearLayerAndDataMaps();

    const newGeorefLayer: GeorefLayer = georefResponse.georefLayer;

    this.geoserverService.createWMSLayer(newGeorefLayer.layerName, newGeorefLayer.wmsUrl, newGeorefLayer.workspace)
      .subscribe((layer: TileLayer) => {
        newGeorefLayer.layer = layer;
        newGeorefLayer.opacity = 1;

        this.layerService.addGeorefLayertoList(newGeorefLayer);
        this.imageService.clearImage();
        this.isProcessing = false;
      });

  }
}
