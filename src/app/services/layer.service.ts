import { Injectable } from '@angular/core';
import OLMap from 'ol/Map';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import ImageSource from 'ol/source/Image';
import { getCenter } from 'ol/extent';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import VectorSource from 'ol/source/Vector';
import { BehaviorSubject, Observable } from 'rxjs';
import Static from 'ol/source/ImageStatic';
import Feature from 'ol/Feature';
import View from 'ol/View';
import { Point } from 'ol/geom';
import { Projection } from 'ol/proj';
import { Style, Fill } from 'ol/style';
import Text from 'ol/style/Text';
import { colors } from '../shared/colors';
import { WMSLayer } from '../models/wms-layer.model';
import { GcpService } from './gcp.service';
import TileLayer from 'ol/layer/Tile';
import BaseLayer from 'ol/layer/Base';
import { GCP } from '../models/gcp.model';
import MapBrowserEvent from 'ol/MapBrowserEvent';

@Injectable({
  providedIn: 'root'
})
export class LayerService {

  // Image
  private imageUrl = "";
  imageWidth = 0;
  imageHeight = 0;
  private extent: number[] = [];
  private imageLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private imageLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.imageLayers);
  private imageMap: OLMap = new OLMap();
  private imageMapSubject = new BehaviorSubject<OLMap>(this.imageMap);
  private imageLayer: ImageLayer<ImageSource> = new ImageLayer<ImageSource>();
  imageLayers$ = this.imageLayersSubject;
  imageMap$ = this.imageMapSubject;

  // Map
  private mapLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private mapLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.mapLayers);
  mapLayers$ = this.mapLayersSubject;

  // Georef Layers
  private georefLayersSubject = new BehaviorSubject<WMSLayer[]>([]);
  georefLayers$ = this.georefLayersSubject.asObservable();

  constructor(
    private gcpService: GcpService,
  ) { }

  // Image Operations

  getCurrentExtent(): number[] {
    return this.extent;
  }

  setNewExtent(newExtent: number[]): void {
    this.extent = newExtent;
  }

  getCurrentImageUrl(): string {
    return this.imageUrl;
  }

  setNewImageUrl(url: string): void {
    this.imageUrl = url;
  }

  getImageWidth(): number {
    return this.imageWidth;
  }

  getImageHeight(): number {
    return this.imageHeight;
  }

  setImageWidth(width: number): void {
    this.imageWidth = width;
  }

  setImageHeight(height: number): void {
    this.imageHeight = height;
  }

  zoomIn(): void {
    const view = this.imageMap.getView();
    view.animate({
      zoom: view.getZoom()! + 0.5,  // Augmente le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }

  zoomOut(): void {
    const view = this.imageMap.getView();
    view.animate({
      zoom: view.getZoom()! - 0.5,  // Diminue le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }

  recenterView(): void {
    if (this.imageMap) {
      const view = this.imageMap.getView();
      view.animate({
        center: getCenter(this.extent), // Recentre sur l’image
        zoom: 1, // Zoom initial
        duration: 300 // Animation fluide
      });
    }
  }

  resetImage(): void {
    this.imageMap.setTarget('');
  }

  clearAllGcpImageLayers(): void {
    for (; this.imageLayers.size > 0;) {
      this.deleteGcpImageLayer(this.imageLayers.size);
    }
  }

  createImageLayer(): ImageLayer<ImageSource> {
    this.imageLayer = new ImageLayer({
      source: new Static({
        url: this.imageUrl,
        imageExtent: this.extent,
        projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.extent })
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
          projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.extent }),
          showFullExtent: true,
          center: [this.imageWidth / 2, this.imageHeight / 2],
          zoom: 1
        }),
        layers: [this.createImageLayer()],
        controls: defaultControls({ zoom: false, attribution: false, rotate: false })
      });
      this.imageMapSubject.next(this.imageMap);

      this.imageMap.on('pointermove', (event) => {
        const coords = event.coordinate;
        this.gcpService.cursorCoordinates.next({
          x: parseFloat(coords[0].toFixed(4)),
          y: parseFloat(coords[1].toFixed(4)) - this.imageHeight,
        });
      });
    }, 200); // Petit délai pour s'assurer que le DOM est prêt
  }

  getImageMap(): OLMap | null {
    return this.imageMapSubject.getValue(); // Récupération de l'état actuel
  }

  syncImageLayers(): void {
    const imageMap = this.getImageMap(); // Récupérer la carte OpenLayers
    if (!imageMap) return;

    const mapLayers = imageMap.getLayers().getArray(); // Liste des couches actuelles
    const gcpLayersSet = new Set(this.imageLayers.values()); // Set des couches de imageLayers

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
    const baseStyle = this.gcpService.gcpStyles[(index - 1) % 20]; // Récupère la base

    // Crée une copie indépendante du style pour éviter les conflits
    const newStyle = new Style({
      image: baseStyle.getImage()!, // Réutilise l'icône du style
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
      geometry: new Point([x, y])
    });

    const pointStyle = this.applyLayerStyle(this.imageLayers.size + 1);

    const newGcpLayer = new VectorLayer({
      source: new VectorSource(
        { features: [feature] }
      ),
      extent: this.extent,
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
    // Réindexer les GCPs dans gcpLayers
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;

    this.imageLayers.forEach((layer) => {
      newImageLayers.set(newIndex++, layer);
    });
    return newImageLayers;
  }

  addGcpImageLayerToList(newGcplayer: VectorLayer): void {
    // Cloner la Map pour forcer la détection du changement
    const updatedImageLayers = new Map(this.imageLayers);
    updatedImageLayers.set(updatedImageLayers.size + 1, newGcplayer);

    this.imageLayers = updatedImageLayers;
    this.imageLayersSubject.next(this.imageLayers);
  }

  deleteLastGcpImageLayer(): number {
    const size = this.imageLayers.size;
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>(this.imageLayers);
    if (size > 0) {
      newImageLayers.delete(size);
      this.imageLayers = newImageLayers;
      this.imageLayersSubject.next(this.imageLayers);
    }
    return size;
  }

  deleteGcpImageLayer(index: number): void {
    const layerToRemove = this.imageLayers.get(index);
    if (!layerToRemove) return;

    this.imageLayers.delete(index);
    const newImageLayers = this.reindexImageLayers();
    this.imageLayers = newImageLayers;
    this.imageLayersSubject.next(this.imageLayers);
  }

  updateImageGcpPosition(index: number, sourceX: number, sourceY: number): void {
    const gcpLayer = this.imageLayers.get(index);
    if (gcpLayer) {
      // Mettre à jour la position de la couche (exemple avec OpenLayers)
      const feature = gcpLayer.getSource()?.getFeatures()[0];
      if (feature) {
        feature.setGeometry(new Point([sourceX, sourceY + this.imageHeight]));
      }
    }
  }

  loadImageLayers(gcps: GCP[]): void {
    gcps.forEach((gcp) => {
      const newGcpLayer = this.createGcpImageLayer(gcp.sourceX, gcp.sourceY + this.imageHeight);
      this.addGcpImageLayerToList(newGcpLayer);
    });
  }

  // Map Operations

  syncMapLayers(map: OLMap, OSMLayer: BaseLayer): void {
    if (!map) return;

    const mapLayers = map.getLayers().getArray(); // Liste des couches actuelles
    const gcpLayersSet = new Set(this.mapLayers.values()); // Set des couches de mapLayers
    const georefLayersSet = new Set(this.georefLayersSubject.getValue().map(layer => layer.layer));

    // 1️⃣ Supprimer les couches qui ne sont plus dans `mapLayers`
    mapLayers.forEach((layer: BaseLayer) => {
      const isNotInGcpLayers = !gcpLayersSet.has(layer as VectorLayer<VectorSource>);
      const isNotOSMLayer = layer !== OSMLayer;
      const isNotInGeorefLayers = !georefLayersSet.has(layer as TileLayer);

      if (isNotInGcpLayers && isNotOSMLayer && isNotInGeorefLayers) {
        this.removeLayerFromMap(map, layer as VectorLayer<VectorSource>);
      }
    });

    // 2️⃣ Ajouter les nouvelles couches de `mapLayers`
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
    if (!map.getLayers().getArray().includes(newlayer)) {
      map.addLayer(newlayer);
    }
  }

  addGeorefLayertoList(georefLayer: WMSLayer): void {
    const currentGeorefLayers = this.georefLayersSubject.getValue();
    const isLayerPresent = currentGeorefLayers.some(layer => layer === georefLayer);

    if (!isLayerPresent) {
      const updatedGeorefLayers = [...currentGeorefLayers, georefLayer];
      this.georefLayersSubject.next(updatedGeorefLayers);
    }
  }

  deleteGeorefLayerFromMap(georefLayer: WMSLayer): void {
    const currentGeorefLayers = this.georefLayersSubject.getValue();
    const updatedGeorefLayers = currentGeorefLayers.filter(layer => layer !== georefLayer);
    this.georefLayersSubject.next(updatedGeorefLayers);
  }

  removeLayerFromMap(map: OLMap, removedLayer: BaseLayer): void {
    map.removeLayer(removedLayer);
  }

  removeAllGcpLayersFromMap(map: OLMap): void {
    this.mapLayers.forEach((layer) => {
      this.removeLayerFromMap(map, layer);
    });
  }

  reindexMapLayers(): Map<number, VectorLayer<VectorSource>> {
    // Réindexer les GCPs dans gcpLayers
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;

    this.mapLayers.forEach((layer) => {
      newImageLayers.set(newIndex++, layer);
    });
    return newImageLayers;
  }

  addGcpMapLayerToList(newGcplayer: VectorLayer): void {
    // Cloner la Map pour forcer la détection du changement
    const updatedImageLayers = new Map(this.mapLayers);
    updatedImageLayers.set(updatedImageLayers.size + 1, newGcplayer);

    this.mapLayers = updatedImageLayers;
    this.mapLayersSubject.next(this.mapLayers);
  }

  deleteGcpMapLayer(index: number): void {
    const layerToRemove = this.mapLayers.get(index);
    if (!layerToRemove) return;

    this.mapLayers.delete(index);
    const newImageLayers = this.reindexMapLayers();
    this.mapLayers = newImageLayers;
    this.mapLayersSubject.next(this.mapLayers);
  }

  deleteLastGcpMapLayer(deletedIndex: number): void {
    if (this.mapLayers.size < deletedIndex) return;
    const size = this.mapLayers.size;
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>(this.mapLayers);
    if (size > 0) {
      newImageLayers.delete(size);
      this.mapLayers = newImageLayers;
      this.mapLayersSubject.next(this.mapLayers);
    }
  }

  updateMapGcpPosition(index: number, mapX: number, mapY: number): void {
    const gcpLayer = this.mapLayers.get(index);
    if (gcpLayer) {
      // Mettre à jour la position de la couche (exemple avec OpenLayers)
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

  loadMapLayers(gcps: GCP[]): void {
    gcps.forEach((gcp) => {
      const newGcpLayer = this.createGcpMapLayer(gcp.mapX!, gcp.mapY!);
      this.addGcpMapLayerToList(newGcpLayer);
    });
  }

  selectGcpFromMap(map: OLMap): Observable<{ x: number, y: number }> {
    return new Observable(observer => {
      const mapClickHandler = (event: MapBrowserEvent<MouseEvent>) => {
        const clickedCoord = map.getCoordinateFromPixel(event.pixel);
        // Convert coordinates if necessary
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

}

