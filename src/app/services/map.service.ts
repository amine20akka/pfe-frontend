import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, switchMap } from 'rxjs';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions, Interaction } from 'ol/interaction';
import TileLayer from 'ol/layer/Tile';
// import OSM from 'ol/source/OSM';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GcpDialogComponent } from '../components/gcp-dialog/gcp-dialog.component';
import { GcpService } from './gcp.service';
import { XYZ } from 'ol/source';
import { GcpDto } from '../dto/gcp-dto';
import { LayerService } from './layer.service';
import { ImageService } from './image.service';
import BaseLayer from 'ol/layer/Base';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Circle as CircleStyle, Style, Stroke } from 'ol/style';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { ImageFileService } from './image-file.service';
import { GeorefLayer } from '../models/georef-layer.model';
import { GeorefApiService } from './georef-api.service';
import { NotificationService } from './notification.service';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map!: OLMap;
  private OSMLayer: TileLayer = new TileLayer();
  private mapSubject = new BehaviorSubject<OLMap | null>(null);
  private isMapSelectionSubject = new BehaviorSubject<boolean>(false);
  private mapCoordinates = new BehaviorSubject<{ x: number, y: number }>({ x: 0, y: 0 });
  map$ = this.mapSubject.asObservable();
  mapCoordinates$ = this.mapCoordinates.asObservable();
  isMapSelection$ = this.isMapSelectionSubject.asObservable();

  constructor(
    private dialog: MatDialog,
    private gcpService: GcpService,
    private layerService: LayerService,
    private imageService: ImageService,
    private imageFileService: ImageFileService,
    private georefApiService: GeorefApiService,
    private notifService: NotificationService,
  ) {
    this.isMapSelection$
      .pipe(
        filter(isSelecting => isSelecting), // Proceed only if selection is active
        switchMap(() => this.layerService.selectGcpFromMap(this.map)) // Wait for map click
      )
      .subscribe((coords) => {
        if (coords) {
          // Reopen the dialog with selected coordinates
          const dialogRef = this.openGcpDialog(coords.x, coords.y);
          this.updateMapSelection(false);

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.gcpService.addGcp(
                this.imageService.getGeorefImage().id,
                this.imageFileService.cursorCoordinates.getValue().x,
                this.imageFileService.cursorCoordinates.getValue().y,
                result.mapX,
                result.mapY
              ).subscribe((savedGcp: GcpDto | null) => {
                if (savedGcp && (coords.x !== result.mapX || coords.y !== result.mapY)) {
                  this.layerService.updateMapGcpPosition(savedGcp.index, result.mapX, result.mapY);
                }
              });
            }
          });
        }
      });
  }

  // createOSMLayer(): TileLayer {
  //   this.OSMLayer = new TileLayer({
  //     source: new OSM()
  //   })
  //   return this.OSMLayer;
  // }

  createSatelliteLayer(): TileLayer {
    this.OSMLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      })
    });
    return this.OSMLayer;
  }

  initMap(target: string): void {
    if (!this.map) {
      this.map = new OLMap({
        target: target,
        interactions: defaultInteractions(),
        layers: [this.createSatelliteLayer()],
        view: new View({
          projection: 'EPSG:3857', // Projection Web Mercator
          center: [-59598.84, 5339845.08],
          zoom: 18
        }),
        controls: defaultControls({ zoom: false, attribution: false, rotate: false })
      });

      this.mapSubject.next(this.map);

      this.map.on('pointermove', (event) => {
        const coords = event.coordinate;
        this.mapCoordinates.next({
          x: parseFloat(coords[0].toFixed(4)),
          y: parseFloat(coords[1].toFixed(4))
        });
      });
    } else {
      this.map.setTarget(target);
    }
    this.mapSubject.next(this.map);
  }

  addWfsLayers() {
    const cableSource = new VectorSource({
      format: new GeoJSON(),
      url: (extent) =>
        'http://localhost:8080/geoserver/drawing/ows?' +
        'service=WFS&version=1.1.0&request=GetFeature&typename=drawing:cable&' +
        'outputFormat=application/json&srsname=EPSG:3857&bbox=' + extent.join(',') + ',EPSG:3857',
      strategy: bboxStrategy
    });

    const supportSource = new VectorSource({
      format: new GeoJSON(),
      url: (extent) =>
        'http://localhost:8080/geoserver/drawing/ows?' +
        'service=WFS&version=1.1.0&request=GetFeature&typename=drawing:st_support&' +
        'outputFormat=application/json&srsname=EPSG:3857&bbox=' + extent.join(',') + ',EPSG:3857',
      strategy: bboxStrategy
    });

    const cableLayer = new VectorLayer({
      source: cableSource,
      style: new Style({
        stroke: new Stroke({
          color: '#EA5863',
          width: 2
        })
      })
    });

    const supportLayer = new VectorLayer({
      source: supportSource,
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#03A9F4' })
        })
      })
    });

    this.addLayerToMap(cableLayer);
    this.addLayerToMap(supportLayer);
  }

  getMap(): OLMap | null {
    return this.mapSubject.getValue();
  }

  addLayerToMap(newlayer: BaseLayer): void {
    this.layerService.addLayerToMap(this.map, newlayer);
  }

  syncMapLayers(): void {
    this.layerService.syncMapLayers(this.map, this.OSMLayer);
  }

  updateMapSelection(status: boolean): void {
    this.isMapSelectionSubject.next(status);
  }

  removeLayerFromMap(removedLayer: BaseLayer): void {
    this.map.removeLayer(removedLayer);
  }

  removeAllGcpLayersFromMap(): void {
    this.layerService.removeAllGcpLayersFromMap(this.map);
  }

  deleteGeorefLayerFromMap(georefLayer: GeorefLayer): void {
    this.georefApiService.deleteGeorefLayerById(georefLayer.id).subscribe({
      next: () => {
        this.layerService.deleteGeorefLayerFromMap(georefLayer);
        this.removeLayerFromMap(georefLayer.layer!);
      }
    })
  }

  removeGeorefLayerAndImageFromMap(georefLayer: GeorefLayer): void {
    this.georefApiService.deleteGeorefLayerAndImageById(georefLayer.id).subscribe({
      next: () => {
        this.layerService.deleteGeorefLayerFromMap(georefLayer);
        this.removeLayerFromMap(georefLayer.layer!);
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Couche géoréférencée introuvable !");
        }
      }
    })
  }

  openGcpDialog(x: number, y: number): MatDialogRef<GcpDialogComponent> {
    return this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true,
      data: { x, y }
    });
  }

  toggleLayerVisibility(layer: TileLayer): void {
    layer.setVisible(!layer.getVisible());
  }

  removeInteraction(DrawInteraction: Interaction): void {
    if (this.map) {
      this.map.removeInteraction(DrawInteraction);
    }
  }

  addInteraction(DrawInteraction: Interaction): void {
    if (this.map) {
      this.map.addInteraction(DrawInteraction);
    }
  }


}
