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
import { FromDto, GcpDto } from '../dto/gcp-dto';
import { GcpApiService } from './gcp-api.service';
import { LayerService } from './layer.service';
import { ImageService } from './image.service';
import BaseLayer from 'ol/layer/Base';
import { WMSLayer } from '../models/wms-layer.model';
import { NotificationService } from './notification.service';

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
    private gcpApiService: GcpApiService,
    private notifService: NotificationService,
  ) {
    // Subscribe to isMapSelection changes
    this.isMapSelection$
      .pipe(
        filter(isSelecting => isSelecting), // Proceed only if selection is active
        switchMap(() => this.layerService.selectGcpFromMap(this.map)) // Wait for map click
      )
      .subscribe((coords) => {
        if (coords) {
          // Reopen the dialog with selected coordinates
          const dialogRef = this.openGcpDialog(coords.x, coords.y);
          this.isMapSelectionSubject.next(false); // Reset selection state

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              const addGcpRequest = this.gcpService.createAddGcpRequest(
                this.imageService.getGeorefImage().id,
                this.gcpService.cursorCoordinates.getValue().x,
                this.gcpService.cursorCoordinates.getValue().y,
                result.mapX,
                result.mapY,
              );

              this.gcpApiService.addGcp(addGcpRequest).subscribe({
                next: (savedGcp: GcpDto) => {
                  if (savedGcp) {
                    this.gcpService.createGCP(
                      savedGcp.sourceX, savedGcp.sourceY, savedGcp.mapX!, savedGcp.mapY!, savedGcp.imageId, savedGcp.id
                    );
                    this.gcpService.addGcpToList(FromDto(savedGcp));
                    if (coords.x !== result.mapX || coords.y !== result.mapY) {
                      this.layerService.updateMapGcpPosition(savedGcp.index, result.mapX, result.mapY);
                    }
                  }
                },
                error: (err) => {
                  if (err.status === 409) {
                    this.notifService.showError("Un point existe déjà avec cet index !");
                  } else if (err.status === 404) {
                    this.notifService.showError("Image non trouvée ! Veuillez importer une image d'abord.");
                  } else if (err.status === 400) {
                    this.notifService.showError("Erreur de validation des données !");
                  }
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

      // Écouter les mouvements du curseur pour récupérer les coordonnées
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

  getMap(): OLMap | null {
    return this.mapSubject.getValue(); // Récupération de l'état actuel
  }

  addLayerToMap(newlayer: BaseLayer): void {
    this.layerService.addLayerToMap(this.map, newlayer);
  }

  syncMapLayers(): void {
    this.layerService.syncMapLayers(this.map, this.OSMLayer);
  }

  updateMapSelection(status: boolean): void {
    this.isMapSelectionSubject.next(status); // Activate map selection mode
  }

  removeLayerFromMap(removedLayer: BaseLayer): void {
    this.map.removeLayer(removedLayer);
  }

  removeAllGcpLayersFromMap(): void {
    this.layerService.removeAllGcpLayersFromMap(this.map);
  }

  deleteGeorefLayerFromMap(georefLayer: WMSLayer): void {
    this.imageService.clearGeorefImage();
    this.layerService.deleteGeorefLayerFromMap(georefLayer);
    this.removeLayerFromMap(georefLayer.layer);
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
