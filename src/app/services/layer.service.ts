import { Injectable } from '@angular/core';
import OLMap from 'ol/Map';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import ImageSource from 'ol/source/Image';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import { colors } from '../shared/colors';
import { getCenter } from 'ol/extent';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import VectorSource from 'ol/source/Vector';
import { BehaviorSubject, forkJoin, map, Observable, tap } from 'rxjs';
import Static from 'ol/source/ImageStatic';
import Feature from 'ol/Feature';
import View from 'ol/View';
import { Point } from 'ol/geom';
import { Projection } from 'ol/proj';
import Text from 'ol/style/Text';
import TileLayer from 'ol/layer/Tile';
import BaseLayer from 'ol/layer/Base';
import { GCP } from '../models/gcp.model';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import { ImageFileService } from './image-file.service';
import { GeorefLayer } from '../models/georef-layer.model';
import { GeoserverService } from './geoserver.service';
import { MockLayer } from '../interfaces/mock-layer';

@Injectable({
  providedIn: 'root'
})
export class LayerService {

  private gcpStyles: Style[] = [];

  // Image Layers
  private imageLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private imageLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.imageLayers);
  private imageMap: OLMap = new OLMap();
  private imageMapSubject = new BehaviorSubject<OLMap>(this.imageMap);
  private imageLayer: ImageLayer<ImageSource> = new ImageLayer<ImageSource>();
  imageLayers$ = this.imageLayersSubject;
  imageMap$ = this.imageMapSubject;

  // GCP Map Layers
  private mapLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private mapLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.mapLayers);
  mapLayers$ = this.mapLayersSubject;

  // Georef Layers
  private georefLayersSubject = new BehaviorSubject<GeorefLayer[]>([]);
  georefLayers$ = this.georefLayersSubject.asObservable();

  // Mock Layers
  private mockLayersSubject = new BehaviorSubject<MockLayer[]>([]);
  mockLayers$ = this.mockLayersSubject.asObservable();

  constructor(
    private imageFileService: ImageFileService,
    private geoserverService: GeoserverService,
  ) {
    this.initGcpStyles();
  }

  private initGcpStyles(): void {
    for (let i = 0; i < 20; i++) {
      this.gcpStyles.push(new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: colors[i % colors.length].fill }),
        })
      }));
    }
  }

  zoomIn(): void {
    const view = this.imageMap.getView();
    view.animate({
      zoom: view.getZoom()! + 0.5,
    });
  }

  zoomOut(): void {
    const view = this.imageMap.getView();
    view.animate({
      zoom: view.getZoom()! - 0.5,
      duration: 300
    });
  }

  recenterView(): void {
    if (this.imageMap) {
      const view = this.imageMap.getView();
      view.animate({
        center: getCenter(this.imageFileService.getCurrentExtent()),
        zoom: 1,
        duration: 300
      });
    }
  }

  resetImage(): void {
    this.imageFileService.setImageHeight(0);
    this.imageFileService.setImageWidth(0);
    this.imageMap.setTarget('');
  }

  // GCP Image Layers Operations

  clearAllGcpImageLayers(): void {
    for (; this.imageLayers.size > 0;) {
      this.deleteGcpImageLayer(this.imageLayers.size);
    }
  }

  createImageLayer(): ImageLayer<ImageSource> {
    this.imageLayer = new ImageLayer({
      source: new Static({
        url: this.imageFileService.getImageUrl()!,
        imageExtent: this.imageFileService.getCurrentExtent(),
        projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.imageFileService.getCurrentExtent() })
      })
    })
    return this.imageLayer;
  }

  initImageLayer(target: string): void {
    setTimeout(() => {
      this.imageMap = new OLMap({
        target: target,
        interactions: defaultInteractions(),
        view: new View({
          projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.imageFileService.getCurrentExtent() }),
          showFullExtent: true,
          center: [this.imageFileService.getImageWidth() / 2, this.imageFileService.getImageHeight() / 2],
          zoom: 1
        }),
        layers: [this.createImageLayer()],
        controls: defaultControls({ zoom: false, attribution: false, rotate: false })
      });
      this.imageMapSubject.next(this.imageMap);

      this.imageMap.on('pointermove', (event) => {
        const coords = event.coordinate;
        this.imageFileService.cursorCoordinates.next({
          x: parseFloat(coords[0].toFixed(4)),
          y: parseFloat(coords[1].toFixed(4)) - this.imageFileService.getImageHeight(),
        });
      });
    }, 200);
  }

  getImageMap(): OLMap | null {
    return this.imageMapSubject.getValue();
  }

  syncImageLayers(): void {
    const imageMap = this.getImageMap();
    if (!imageMap) return;

    const mapLayers = imageMap.getLayers().getArray();
    const gcpLayersSet = new Set(this.imageLayers.values());

    mapLayers.forEach(layer => {
      if (!gcpLayersSet.has(layer as VectorLayer<VectorSource>) && layer !== this.imageLayer) {
        this.removeGcpLayerFromImage(layer as VectorLayer<VectorSource>);
      }
    });

    this.imageLayers.forEach((layer, index) => {
      this.updateLayerStyle(index, layer);
      if (!mapLayers.includes(layer)) {
        this.addGcpLayerToImage(layer);
      }
    });
  }

  applyLayerStyle(index: number): Style {
    const baseStyle = this.gcpStyles[(index - 1) % 20];

    const newStyle = new Style({
      image: baseStyle.getImage()!,
      fill: baseStyle.getFill()!,
      stroke: baseStyle.getStroke()!,
      text: new Text({
        text: index.toString(),
        font: '12px Arial',
        fill: new Fill({ color: colors[(index - 1) % 20].text }),
        textAlign: 'center',
        textBaseline: 'middle',
        offsetY: 0
      })
    });

    return newStyle;
  }

  updateLayerStyle(index: number, updatedGcpLayer: VectorLayer): void {
    const updatedStyle = this.applyLayerStyle(index);
    updatedGcpLayer.setStyle(updatedStyle);
  }

  createGcpImageLayer(x: number, y: number): VectorLayer {
    const feature = new Feature({
      geometry: new Point([x, y + this.imageFileService.getImageHeight()])
    });

    const pointStyle = this.applyLayerStyle(this.imageLayers.size + 1);

    const newGcpLayer = new VectorLayer({
      source: new VectorSource(
        { features: [feature] }
      ),
      extent: this.imageFileService.getCurrentExtent(),
      style: pointStyle,
    });
    newGcpLayer.setVisible(true);
    newGcpLayer.setZIndex(1000);

    return newGcpLayer;
  }

  addGcpLayerToImage(newGcplayer: VectorLayer): void {
    if (!this.imageMap.getLayers().getArray().includes(newGcplayer)) {
      this.imageMap.addLayer(newGcplayer);
    }
  }

  removeGcpLayerFromImage(removedGcpLayer: VectorLayer): void {
    this.imageMap.removeLayer(removedGcpLayer);
  }

  reindexImageLayers(): Map<number, VectorLayer<VectorSource>> {
    const updatedGcpImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;

    this.imageLayers.forEach((layer) => {
      updatedGcpImageLayers.set(newIndex++, layer);
    });
    return updatedGcpImageLayers;
  }

  addGcpImageLayerToList(newGcplayer: VectorLayer): void {
    const updatedGcpImageLayers = new Map(this.imageLayers);
    updatedGcpImageLayers.set(updatedGcpImageLayers.size + 1, newGcplayer);

    this.updateGcpImageLayers(updatedGcpImageLayers);
  }

  deleteLastGcpImageLayer(): number {
    const size = this.imageLayers.size;
    const updatedGcpImageLayers = new Map<number, VectorLayer<VectorSource>>(this.imageLayers);
    if (size > 0) {
      updatedGcpImageLayers.delete(size);
      this.updateGcpImageLayers(updatedGcpImageLayers);
    }
    return size;
  }

  deleteGcpImageLayer(index: number): void {
    const layerToRemove = this.imageLayers.get(index);
    if (!layerToRemove) return;

    this.imageLayers.delete(index);
    const updatedGcpImageLayers = this.reindexImageLayers();
    this.updateGcpImageLayers(updatedGcpImageLayers);
  }

  updateImageGcpPosition(index: number, sourceX: number, sourceY: number): void {
    const gcpLayer = this.imageLayers.get(index);
    if (gcpLayer) {
      const feature = gcpLayer.getSource()?.getFeatures()[0];
      if (feature) {
        feature.setGeometry(new Point([sourceX, sourceY + this.imageFileService.getImageHeight()]));
      }
    }
  }

  updateGcpImageLayers(updatedGcpImageLayers: Map<number, VectorLayer<VectorSource>>): void {
    this.imageLayers = updatedGcpImageLayers;
    this.imageLayersSubject.next(this.imageLayers);
  }

  loadGcpImageLayers(gcps: GCP[]): void {
    gcps.forEach((gcp) => {
      const newGcpLayer = this.createGcpImageLayer(gcp.sourceX, gcp.sourceY);
      this.addGcpImageLayerToList(newGcpLayer);
    });
  }


  // GCP Map Layers Operations

  syncMapLayers(map: OLMap, OSMLayer: BaseLayer): void {
    if (!map) return;

    const mapLayers = map.getLayers().getArray();
    const gcpLayersSet = new Set(this.mapLayers.values());
    const georefLayersSet = new Set(this.georefLayersSubject.getValue().map(layer => layer.layer));
    const mockLayersSet = new Set(this.mockLayersSubject.getValue().map(mockLayer => mockLayer.wfsLayer));

    // Etape 1 : Supprimer les couches qui ne sont plus dans `mapLayers`
    mapLayers.forEach((layer: BaseLayer) => {
      const isNotInGcpLayers = !gcpLayersSet.has(layer as VectorLayer<VectorSource>);
      const isNotOSMLayer = layer !== OSMLayer;
      const isNotInGeorefLayers = !georefLayersSet.has(layer as TileLayer);
      const isNotInMockLayers = !mockLayersSet.has(layer as VectorLayer);

      if (isNotInGcpLayers && isNotOSMLayer && isNotInGeorefLayers && isNotInMockLayers) {
        this.removeLayerFromMap(map, layer as VectorLayer<VectorSource>);
      }
    });

    // Etape 2 : Ajouter les nouvelles couches de `mapLayers`
    this.mapLayers.forEach((layer, index) => {
      this.updateLayerStyle(index, layer);
      if (!mapLayers.includes(layer)) {
        this.addLayerToMap(map, layer);
      }
    });
  }

  createGcpMapLayer(x: number, y: number): VectorLayer {
    const feature = new Feature({
      geometry: new Point([x, y])
    });

    const pointStyle = this.applyLayerStyle(this.mapLayers.size + 1);

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

  addLayerToMap(map: OLMap, newlayer: BaseLayer): void {
    map.addLayer(newlayer);
  }

  removeLayerFromMap(map: OLMap, removedLayer: BaseLayer): void {
    map.removeLayer(removedLayer);
  }

  removeAllGcpLayersFromMap(map: OLMap): void {
    this.mapLayers.forEach((layer) => {
      this.removeLayerFromMap(map, layer);
    });
  }

  reindexGcpMapLayers(): Map<number, VectorLayer<VectorSource>> {
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;

    this.mapLayers.forEach((layer) => {
      newImageLayers.set(newIndex++, layer);
    });
    return newImageLayers;
  }

  addGcpMapLayerToList(newGcplayer: VectorLayer): void {
    const updatedGcpMapLayers = new Map(this.mapLayers);
    updatedGcpMapLayers.set(updatedGcpMapLayers.size + 1, newGcplayer);

    this.updateGcpMapLayers(updatedGcpMapLayers);
  }

  updateGcpMapLayers(newGcpMapLayers: Map<number, VectorLayer<VectorSource>>): void {
    this.mapLayers = newGcpMapLayers;
    this.mapLayersSubject.next(this.mapLayers);
  }

  deleteGcpMapLayer(index: number): void {
    const layerToRemove = this.mapLayers.get(index);
    if (!layerToRemove) return;

    this.mapLayers.delete(index);
    const updatedGcpMapLayers = this.reindexGcpMapLayers();
    this.updateGcpMapLayers(updatedGcpMapLayers);
  }

  deleteLastGcpMapLayer(deletedIndex: number): void {
    if (this.mapLayers.size < deletedIndex) return;
    const size = this.mapLayers.size;
    const updatedGcpMapLayers = new Map<number, VectorLayer<VectorSource>>(this.mapLayers);
    if (size > 0) {
      updatedGcpMapLayers.delete(size);
      this.updateGcpMapLayers(updatedGcpMapLayers);
    }
  }

  updateMapGcpPosition(index: number, mapX: number, mapY: number): void {
    const gcpLayer = this.mapLayers.get(index);
    if (gcpLayer) {
      const feature = gcpLayer.getSource()?.getFeatures()[0];
      if (feature) {
        feature.setGeometry(new Point([mapX, mapY]));
      }
    }
  }

  clearAllGcpMapLayers(): void {
    for (; this.mapLayers.size > 0;) {
      this.deleteGcpMapLayer(this.mapLayers.size);
    }
  }

  loadGcpMapLayers(gcps: GCP[]): void {
    gcps.forEach((gcp) => {
      const newGcpLayer = this.createGcpMapLayer(gcp.mapX!, gcp.mapY!);
      this.addGcpMapLayerToList(newGcpLayer);
    });
  }

  selectGcpFromMap(map: OLMap): Observable<{ x: number, y: number }> {
    return new Observable(observer => {
      const mapClickHandler = (event: MapBrowserEvent<MouseEvent>) => {
        const clickedCoord = map.getCoordinateFromPixel(event.pixel);
        observer.next({ x: clickedCoord[0], y: clickedCoord[1] });

        if (this.mapLayers.size == this.imageLayers.size) {
          this.updateMapGcpPosition(this.mapLayers.size, clickedCoord[0], clickedCoord[1]);
        } else {
          const newGcpLayer = this.createGcpMapLayer(clickedCoord[0], clickedCoord[1]);
          this.addGcpMapLayerToList(newGcpLayer);
        }

        // Remove click listener after selecting a point
        map.un('click', mapClickHandler);
        observer.complete();
      };

      // Listen for a single map click
      map.on('click', mapClickHandler);
    });
  }


  // Georef Layer Operations

  addGeorefLayertoList(georefLayer: GeorefLayer): void {
    const currentGeorefLayers = this.georefLayersSubject.getValue();
    const isLayerPresent = currentGeorefLayers.some(layer => layer === georefLayer);

    if (!isLayerPresent) {
      const updatedGeorefLayers = [...currentGeorefLayers, georefLayer];
      this.georefLayersSubject.next(updatedGeorefLayers);
    }
  }

  addGeorefLayersToList(newGeorefLayers: GeorefLayer[]): void {
    const currentGeorefLayers = this.georefLayersSubject.getValue();

    if (newGeorefLayers.length > 0) {
      const updatedGeorefLayers = [...currentGeorefLayers, ...newGeorefLayers];
      this.georefLayersSubject.next(updatedGeorefLayers);
    }
  }

  createWMSLayersAndAddToList(georefLayers: GeorefLayer[]): Observable<void> {
    const layerCreationObservables: Observable<GeorefLayer>[] = [];

    georefLayers.forEach(georefLayer => {
      const layerCreation = this.geoserverService.createWMSLayer(
        georefLayer.layerName,
        georefLayer.wmsUrl,
        georefLayer.workspace
      ).pipe(
        map((layer: TileLayer) => {
          georefLayer.layer = layer;
          georefLayer.opacity = 0.5;
          return georefLayer;
        })
      );
      
      layerCreationObservables.push(layerCreation);
    });

    // Utilise forkJoin pour attendre que toutes les couches soient créées
    return forkJoin(layerCreationObservables).pipe(
      tap((processedLayers: GeorefLayer[]) => {
        this.addGeorefLayersToList(processedLayers);
      }),
      map(() => void 0)
    );
  }

  deleteGeorefLayerFromMap(georefLayer: GeorefLayer): void {
    const currentGeorefLayers = this.georefLayersSubject.getValue();
    const updatedGeorefLayers = currentGeorefLayers.filter(layer => layer !== georefLayer);
    this.georefLayersSubject.next(updatedGeorefLayers);
  }



  // Mock Layers Operations
  
  addToMockLayers(mockLayer: MockLayer) {
    const currentMockLayers = this.mockLayersSubject.getValue();
    const isLayerPresent = currentMockLayers.some(layer => layer.layerId === mockLayer.layerId);

    if (!isLayerPresent) {
      const updatedMockLayers = [...currentMockLayers, mockLayer];
      this.mockLayersSubject.next(updatedMockLayers);
    }
  }

  getVectorLayers(): VectorLayer[] {
    const vectorLayers: VectorLayer[] = [];
    this.mockLayersSubject.getValue().forEach((mockLayer: MockLayer) => {
      const layer = mockLayer.wfsLayer;
      if (layer instanceof VectorLayer) {
        vectorLayers.push(layer);
      }
    });
    return vectorLayers;
  }

  getMockLayers(): MockLayer[] {
    return this.mockLayersSubject.getValue();
  }

  getLayerSourceById(layerId: string): VectorSource | null {
    const mockLayer = this.mockLayersSubject.getValue().find(mockLayer => mockLayer.layerId === layerId);
    return mockLayer ? mockLayer.wfsLayer.getSource() as VectorSource : null;
  }

  refreshLayerSourceById(layerId: string): void {
    const source = this.getLayerSourceById(layerId);
    source!.refresh();
  }
}

