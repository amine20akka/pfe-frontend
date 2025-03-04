import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, Observable, switchMap } from 'rxjs';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import TileLayer from 'ol/layer/Tile';
// import OSM from 'ol/source/OSM';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GcpDialogComponent } from '../components/gcp-dialog/gcp-dialog.component';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import { GcpService } from './gcp.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { ImageService } from './image.service';
import { ImageStatic, XYZ } from 'ol/source';
import { Projection } from 'ol/proj';
import ImageLayer from 'ol/layer/Image';
import { GeoTiffMetadata } from '../interfaces/geotiff-metadata';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map!: OLMap;
  private OSMLayer: TileLayer = new TileLayer();
  private mapSubject = new BehaviorSubject<OLMap | null>(null);
  private mapLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private mapLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.mapLayers);
  private isMapSelectionSubject = new BehaviorSubject<boolean>(false);
  private mapCoordinates = new BehaviorSubject<{ x: number, y: number }>({ x: 0, y: 0 });
  private imageLayersLength!: number;
  map$ = this.mapSubject.asObservable();
  mapLayers$ = this.mapLayersSubject;
  mapCoordinates$ = this.mapCoordinates.asObservable();
  isMapSelection$ = this.isMapSelectionSubject.asObservable();

  constructor(
    private dialog: MatDialog,
    private gcpService: GcpService,
    private imageService: ImageService,
  ) {
    this.imageService.imageLayers$.subscribe((imageLayers) => {
      this.imageLayersLength = imageLayers.size;
    });
    // Subscribe to isMapSelection changes
    this.isMapSelection$
      .pipe(
        filter(isSelecting => isSelecting), // Proceed only if selection is active
        switchMap(() => this.selectGcpFromMap()) // Wait for map click
      )
      .subscribe((coords) => {
        if (coords) {
          // Reopen the dialog with selected coordinates
          const dialogRef = this.openGcpDialog(coords.x, coords.y);
          this.isMapSelectionSubject.next(false); // Reset selection state

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              const newGcp = this.gcpService.createGCP(
                this.gcpService.cursorCoordinates.getValue().x,
                this.gcpService.cursorCoordinates.getValue().y,
                result.mapX,
                result.mapY
              );
              this.gcpService.addGcpToList(newGcp);
              if (coords.x !== result.mapX || coords.y !== result.mapY) {
                this.updateGcpPosition(newGcp.index, result.mapX, result.mapY);
              }
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
        controls: defaultControls({ zoom: false, attribution: false })
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

  syncMapLayers(): void {
    const map = this.getMap(); // Récupérer la carte OpenLayers
    if (!map) return;

    const mapLayers = map.getLayers().getArray(); // Liste des couches actuelles
    const gcpLayersSet = new Set(this.mapLayers.values()); // Set des couches de mapLayers

    // 1️⃣ Supprimer les couches qui ne sont plus dans `mapLayers`
    mapLayers.forEach(layer => {
      if (!gcpLayersSet.has(layer as VectorLayer<VectorSource>) && layer !== this.OSMLayer) {
        this.removeGcpLayerFromMap(layer as VectorLayer<VectorSource>);
      }
    });

    // 2️⃣ Ajouter les nouvelles couches de `mapLayers`
    this.mapLayers.forEach((layer, index) => {
      this.imageService.updateLayerStyle(index, layer);
      if (!mapLayers.includes(layer)) {
        this.addGcpLayerToMap(layer);
      }
    });
  }

  createGcpLayer(x: number, y: number): VectorLayer {
    const feature = new Feature({
      geometry: new Point([x, y])
    });

    const pointStyle = this.imageService.applyLayerStyle(this.mapLayers.size + 1);

    const newGcpLayer = new VectorLayer({
      source: new VectorSource(
        { features: [feature] }
      ),
      style: pointStyle,
    });
    newGcpLayer.setVisible(true);
    newGcpLayer.setZIndex(1000);

    return newGcpLayer;
  }

  addGcpLayerToMap(newGcplayer: VectorLayer): void {
    this.map.addLayer(newGcplayer);
  }

  removeGcpLayerFromMap(removedGcpLayer: VectorLayer): void {
    this.map.removeLayer(removedGcpLayer);
  }

  removeAllGcpLayersFromMap(): void {
    this.mapLayers.forEach((layer) => {
      this.removeGcpLayerFromMap(layer);
    });
  }

  reindex(): Map<number, VectorLayer<VectorSource>> {
    // Réindexer les GCPs dans gcpLayers
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;

    this.mapLayers.forEach((layer) => {
      newImageLayers.set(newIndex++, layer);
    });
    return newImageLayers;
  }

  addGcpLayerToList(newGcplayer: VectorLayer): void {
    // Cloner la Map pour forcer la détection du changement
    const updatedImageLayers = new Map(this.mapLayers);
    updatedImageLayers.set(updatedImageLayers.size + 1, newGcplayer);

    this.mapLayers = updatedImageLayers;
    this.mapLayersSubject.next(this.mapLayers);
  }

  deleteGcpLayer(index: number): void {
    const layerToRemove = this.mapLayers.get(index);
    if (!layerToRemove) return;

    this.mapLayers.delete(index);
    const newImageLayers = this.reindex();
    this.mapLayers = newImageLayers;
    this.mapLayersSubject.next(this.mapLayers);
  }

  deleteLastGcpLayer(deletedIndex: number): void {
    if (this.mapLayers.size < deletedIndex) return;
    const size = this.mapLayers.size;
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>(this.mapLayers);
    if (size > 0) {
      newImageLayers.delete(size);
      this.mapLayers = newImageLayers;
      this.mapLayersSubject.next(this.mapLayers);
    }
  }

  updateGcpPosition(index: number, mapX: number, mapY: number): void {
    const gcpLayer = this.mapLayers.get(index);
    if (gcpLayer) {
      // Mettre à jour la position de la couche (exemple avec OpenLayers)
      const feature = gcpLayer.getSource()?.getFeatures()[0];
      if (feature) {
        feature.setGeometry(new Point([mapX, mapY]));
      }
    }
  }

  startMapSelection() {
    this.isMapSelectionSubject.next(true); // Activate map selection mode
  }

  selectGcpFromMap(): Observable<{ x: number, y: number }> {
    return new Observable(observer => {
      const mapClickHandler = (event: MapBrowserEvent<MouseEvent>) => {
        const clickedCoord = this.map.getCoordinateFromPixel(event.pixel);
        // Convert coordinates if necessary
        observer.next({ x: clickedCoord[0], y: clickedCoord[1] });

        if (this.mapLayers.size === this.imageLayersLength) {
          this.updateGcpPosition(this.mapLayers.size, clickedCoord[0], clickedCoord[1]);
        } else {
          const newGcpLayer = this.createGcpLayer(clickedCoord[0], clickedCoord[1]);
          this.addGcpLayerToList(newGcpLayer);
        }

        // Remove click listener after selecting a point
        this.map.un('click', mapClickHandler);
        observer.complete();
      };

      // Listen for a single map click
      this.map.on('click', mapClickHandler);
    });
  }

  openGcpDialog(x: number, y: number): MatDialogRef<GcpDialogComponent> {
    return this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true,
      data: { x, y }
    });
  }

  clearAllGcpLayers(): void {
    for (; this.mapLayers.size > 0;) {
      this.deleteGcpLayer(this.mapLayers.size);
    }
  }

  addGeoreferencedImageToMap(fileUrl: string, metadata: GeoTiffMetadata['metadata']) {
    // Créer une projection personnalisée
    const projection = new Projection({
      code: metadata && metadata.projection && metadata.projection.epsgCode ? 'EPSG:'.concat(metadata.projection.epsgCode) : 'EPSG:3857',
      extent: [metadata!.extent.minX, metadata!.extent.minY, metadata!.extent.maxX, metadata!.extent.maxY],
    });

    // Créer la couche image
    const georeferencedImageLayer = new ImageLayer({
      source: new ImageStatic({
        url: fileUrl,
        projection: projection,
        imageExtent: [metadata!.extent.minX, metadata!.extent.minY, metadata!.extent.maxX, metadata!.extent.maxY],
      })
    });

    georeferencedImageLayer.setZIndex(2000);
    georeferencedImageLayer.setVisible(true);

    // Ajouter la couche à la carte
    this.map.addLayer(georeferencedImageLayer);
  }

}
