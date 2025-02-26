import { Injectable } from '@angular/core';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { Image as ImageLayer } from 'ol/layer';
import { defaults as defaultControls } from 'ol/control';
import ImageSource from 'ol/source/Image';
import { defaults as defaultInteractions } from 'ol/interaction';
import { getCenter } from 'ol/extent';
import Static from 'ol/source/ImageStatic';
import { Projection } from 'ol/proj';
import { GcpService } from './gcp.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import { colors } from '../shared/colors';
import { BehaviorSubject } from 'rxjs';
import Style from 'ol/style/Style';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private imageLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private imageLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.imageLayers);
  private imageLayer: ImageLayer<ImageSource> = new ImageLayer<ImageSource>();
  private imageUrl = '';
  private imageMap: OLMap = new OLMap();
  private imageMapSubject = new BehaviorSubject<OLMap>(this.imageMap);
  imageMap$ = this.imageMapSubject;
  imageLayers$ = this.imageLayersSubject;
  isDragging = false;
  isImageLoaded = false;
  imageWidth = 0;
  imageHeight = 0;
  private extent = [0, 0, this.imageWidth, this.imageHeight];
  x = 0;
  y = 0;


  constructor(private gcpService: GcpService) {
    this.gcpService.cursorCoordinates.subscribe(coords => {
      this.x = coords.x;
      this.y = coords.y;
    });
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

  zoomIn(): void {
    const view = this.imageMap.getView();
    view.animate({
      zoom: view.getZoom()! + 1,  // Augmente le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }

  zoomOut(): void {
    const view = this.imageMap.getView();
    view.animate({
      zoom: view.getZoom()! - 1,  // Diminue le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }

  resetView(): void {
    if (this.imageMap) {
      const view = this.imageMap.getView();
      view.animate({
        center: getCenter(this.extent), // Recentre sur l’image
        zoom: 1, // Zoom initial
        duration: 300 // Animation fluide
      });
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFile(input.files[0]);
    }
  }

  resetImage(): void {
    this.isImageLoaded = false;
    this.imageUrl = '';
    this.imageWidth = 1000;
    this.imageHeight = 1000;
    this.extent = [0, 0, this.imageWidth, this.imageHeight];
    this.imageMap.setTarget('');
    this.gcpService.cursorCoordinates.next({ x: 0, y: 0 });
    this.gcpService.clearGCPs()
    this.imageLayers.clear();
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      console.error('Format non supporté');
      return;
    }

    this.isImageLoaded = true;
    const reader = new FileReader();

    reader.onload = () => {
      this.imageUrl = URL.createObjectURL(file);

      // Charger l'image pour récupérer ses dimensions réelles
      const img = new Image();
      img.onload = () => {
        this.imageWidth = img.width;
        this.imageHeight = img.height;
        this.extent = [0, 0, this.imageWidth, this.imageHeight];
      };
      img.src = this.imageUrl;
    };

    reader.readAsDataURL(file);
  }

  initImageLayer(target: string): void {
    setTimeout(() => {
      this.imageMap = new OLMap({
        target: target,
        interactions: defaultInteractions(),
        view: new View({
          projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.extent }),
          showFullExtent: true,
          center: getCenter(this.extent),
          zoom: 1
        }),
        layers: [this.createImageLayer()],
        controls: defaultControls({ zoom: false, attribution: false, rotate: false })
      });
      this.imageMapSubject.next(this.imageMap);

      this.imageMap.on('pointermove', (event) => {
        const coords = event.coordinate;
        const invertedY = this.imageHeight - parseFloat(coords[1].toFixed(4)); // Inversion de Y avec 4 décimales
        this.gcpService.cursorCoordinates.next({
          x: parseFloat(coords[0].toFixed(4)),
          y: invertedY
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

    // 1️⃣ Supprimer les couches qui ne sont plus dans `imageLayers`
    mapLayers.forEach(layer => {
      if (!gcpLayersSet.has(layer as VectorLayer<VectorSource>) && layer !== this.imageLayer) {
        this.removeGcpLayerFromImage(layer as VectorLayer<VectorSource>);
      }
    });

    // 2️⃣ Ajouter les nouvelles couches de `imageLayers`
    this.imageLayers.forEach((layer, index) => {
      this.updateLayerStyle(index, layer);
      if (!mapLayers.includes(layer)) {
        this.addGcpLayerToImage(layer);
      }
    });
  }

  applyLayerStyle(index: number): Style {
    const style = this.gcpService.gcpStyles[(index - 1) % 10];
    style.setText(
      new Text({
        text: index.toString(),
        font: '12px Arial', // Augmentez la taille de la police si nécessaire
        fill: new Fill({ color: colors[(index - 1) % 10].text }),
        textAlign: 'center', // Centre le texte horizontalement
        textBaseline: 'middle', // Centre le texte verticalement
        offsetY: 0 // Pas de décalage vertical
      })
    );
    return style;
  }

  updateLayerStyle(index: number, updatedGcpLayer: VectorLayer): void {
    const updatedStyle = this.applyLayerStyle(index);
    updatedGcpLayer.setStyle(updatedStyle);
  }

  createGcpLayer(): VectorLayer {
    const feature = new Feature({
      geometry: new Point([this.x, this.imageHeight - this.y])
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
    this.imageMap.addLayer(newGcplayer);
  }

  removeGcpLayerFromImage(removedGcpLayer: VectorLayer): void {
    this.imageMap.removeLayer(removedGcpLayer);
  }

  reindex(): Map<number, VectorLayer<VectorSource>> {
    // Réindexer les GCPs dans gcpLayers
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;

    this.imageLayers.forEach((layer) => {
      newImageLayers.set(newIndex++, layer);
    });
    return newImageLayers;
  }

  addGcpLayerToList(newGcplayer: VectorLayer): void {
    // Cloner la Map pour forcer la détection du changement
    const updatedImageLayers = new Map(this.imageLayers);
    updatedImageLayers.set(updatedImageLayers.size + 1, newGcplayer);

    this.imageLayers = updatedImageLayers;
    this.imageLayersSubject.next(this.imageLayers);
  }

  deleteLastGcpLayer(): void {
    const size = this.imageLayers.size;
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>(this.imageLayers);
    if (size > 0) {
      newImageLayers.delete(size);
      this.imageLayers = newImageLayers;
      this.imageLayersSubject.next(this.imageLayers);
    }
  }

  deleteGcpLayer(index: number): void {
    const layerToRemove = this.imageLayers.get(index);
    if (!layerToRemove) return;

    this.imageLayers.delete(index);
    const newImageLayers = this.reindex();
    this.imageLayers = newImageLayers;
    this.imageLayersSubject.next(this.imageLayers);
  }

  updateGcpPosition(index: number, sourceX: number, sourceY: number): void {
    const gcpLayer = this.imageLayers.get(index);
    if (gcpLayer) {
      // Mettre à jour la position de la couche (exemple avec OpenLayers)
      const feature = gcpLayer.getSource()?.getFeatures()[0];
      if (feature) {
        feature.setGeometry(new Point([sourceX, sourceY]));
      }
    }
  }
}
