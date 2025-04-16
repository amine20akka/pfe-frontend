import { Injectable } from '@angular/core';
import TileLayer from 'ol/layer/Tile';
import { TileWMS } from 'ol/source';
import { WMSLayer } from '../models/wms-layer.model';
import { Extent } from 'ol/extent';

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
    
    this.fetchLayerExtent(layerName).then((extent) => {
      if (extent) {
        layer.setExtent(extent);
      }
    })
    
    layer.setZIndex(1000);
    const wmsLayer: WMSLayer = {layer: layer, layerName: layerName, opacity: 1};
    return wmsLayer;
  }
  async fetchLayerExtent(layerName: string): Promise<Extent | null> {
    const url = `${this.GEOSERVER_URL}/${this.WORKSPACE}/wms?service=WMS&request=GetCapabilities`;

    try {
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const layers = xml.getElementsByTagName('Layer');

        for (const layerElement of layers) {
            const nameElement = layerElement.getElementsByTagName('Name')[0];
            if (nameElement && nameElement.textContent === layerName) {
                const bboxElements = layerElement.getElementsByTagName('BoundingBox');
                
                for (const bbox of bboxElements) {
                    const srs = bbox.getAttribute('CRS') || bbox.getAttribute('SRS');
                    if (srs === 'EPSG:3857') { // Vérifie que c'est bien le bon EPSG
                        return [
                            parseFloat(bbox.getAttribute('minx')!),
                            parseFloat(bbox.getAttribute('miny')!),
                            parseFloat(bbox.getAttribute('maxx')!),
                            parseFloat(bbox.getAttribute('maxy')!)
                        ];
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors de la récupération de l’extent:', error);
    }
    return null;
}

}
