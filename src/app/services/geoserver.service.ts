import { Injectable } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import { TileWMS } from 'ol/source';
import { WMSLayer } from '../interfaces/wms-layer';

@Injectable({
  providedIn: 'root'
})
export class GeoserverService {

  GEOSERVER_URL = "http://localhost:8080/geoserver"
  WORKSPACE = "poc_georef"

  createWMSLayer(layerName: string): WMSLayer {
    const layer = new TileLayer({
      source: new TileWMS({
        url: `${this.GEOSERVER_URL}/${this.WORKSPACE}/wms`,
        params: { 'LAYERS': layerName, 'TILED': true },
        serverType: 'geoserver',
      })
    });
    layer.setZIndex(1000);
    const wmsLayer: WMSLayer = {layer: layer, layerName: layerName};
    return wmsLayer;
  }
}
