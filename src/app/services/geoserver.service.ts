import { Injectable } from '@angular/core';
import { Extent } from 'ol/extent';
import TileLayer from 'ol/layer/Tile';
import { TileWMS } from 'ol/source';
import { from, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeoserverService {
  /**
   * Crée une couche WMS avec récupération de l'extent
   * @param layerName Nom de la couche sur GeoServer
   * @param wmsUrl URL du service WMS
   * @returns Observable contenant la couche créée avec son extent
   */
  createWMSLayer(layerName: string, wmsUrl: string, workspace: string): Observable<TileLayer> {
    const layer = new TileLayer({
      source: new TileWMS({
        url: wmsUrl,
        params: {
          'LAYERS': layerName,
          'TILED': true,
          'FORMAT': 'image/png',
          'TRANSPARENT': true
        },
        serverType: 'geoserver',
      })
    });

    layer.setZIndex(100);
    layer.setOpacity(1);

    return from(this.fetchLayerExtent(wmsUrl, layerName, workspace)).pipe(
      map(extent => {
        if (extent) {
          layer.setExtent(extent);
        }
        return layer;
      })
    );
  }

  /**
   * Récupère l'extent d'une couche depuis le service WMS
   * @param wmsUrl URL du service WMS
   * @param layerName Nom de la couche
   * @returns Promise avec l'extent ou null si non trouvé
   */
  async fetchLayerExtent(wmsUrl: string, layerName: string, workspace: string): Promise<Extent | null> {
    try {
      const layerNameWithWorkspace = workspace + ":" + layerName;
      const url = new URL(wmsUrl);
      url.searchParams.set('service', 'WMS');
      url.searchParams.set('version', '1.3.0');
      url.searchParams.set('request', 'GetCapabilities');
      url.searchParams.delete('layers');

      const finalUrl = url.toString();

      const response = await fetch(finalUrl);
      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const layers = xml.getElementsByTagName('Layer');

      for (const layerElement of layers) {
        const nameElement = layerElement.getElementsByTagName('Name')[0];
        const foundName = nameElement?.textContent?.trim();

        if (foundName === layerNameWithWorkspace) {
          const bboxElements = layerElement.getElementsByTagName('BoundingBox');
          for (const bbox of bboxElements) {
            const crs = bbox.getAttribute('CRS') || bbox.getAttribute('SRS');

            if (crs === 'EPSG:3857' || crs === 'EPSG:4326') {
              const extent: Extent = [
                parseFloat(bbox.getAttribute('minx')!),
                parseFloat(bbox.getAttribute('miny')!),
                parseFloat(bbox.getAttribute('maxx')!),
                parseFloat(bbox.getAttribute('maxy')!)
              ];
              return extent;
            }
          }
        }
      }

    } catch (error) {
      console.error('Exception :', error);
    }
    return null;
  }
}

