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
import { GeorefImage, GeorefStatus } from '../models/georef-image';
import { CompressionType, ResamplingMethod, SRID, TransformationType } from '../models/georef-settings';
import { GeoserverService } from './geoserver.service';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private georefImageSubject = new BehaviorSubject<GeorefImage>({} as GeorefImage);
  private imageLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private imageLayersSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.imageLayers);
  private imageLayer: ImageLayer<ImageSource> = new ImageLayer<ImageSource>();
  private extent: number[] = [];
  private imageMap: OLMap = new OLMap();
  private imageMapSubject = new BehaviorSubject<OLMap>(this.imageMap);
  georefImage$ = this.georefImageSubject.asObservable();
  imageMap$ = this.imageMapSubject;
  imageLayers$ = this.imageLayersSubject;
  isDragging = false;
  isImageLoaded = false;
  isLoading = false;
  imageWidth = 0;
  imageHeight = 0;
  x = 0;
  y = 0;


  constructor(private gcpService: GcpService, private geoserverService: GeoserverService) {
    this.gcpService.cursorCoordinates.subscribe(coords => {
      this.x = coords.x;
      this.y = coords.y;
    });
    this.gcpService.totalRMSE$.subscribe((value) => {
      this.updateTotalRMSE(value);
    })
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

  resetImage(): void {
    this.isImageLoaded = false;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.imageMap.setTarget('');
    this.gcpService.cursorCoordinates.next({ x: 0, y: 0 });
    this.gcpService.clearGCPs()
    this.clearAllGcpLayers();
    this.georefImageSubject.next({} as GeorefImage);
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
    this.isLoading = true;

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event): void {
    this.isLoading = true; // Afficher immédiatement le spinner
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'tiff', 'tif'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const maxSize = 10 * 1024 * 1024; // 10 Mo

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      console.error('Format non supporté');
      return;
    }

    if (file.size > maxSize) {
      console.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    this.isImageLoaded = false;
    const reader = new FileReader();

    reader.onload = () => {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const minLoadingTime = 1000; // 1 seconde
        const startTime = Date.now();

        const finishLoading = () => {
          this.isLoading = false;
          this.isImageLoaded = true;
          this.imageWidth = img.width;
          this.imageHeight = img.height;
          this.extent = [0, 0, this.imageWidth, this.imageHeight];

          const newGeorefImage = this.createGeorefImage(file, imageUrl);
          this.updateGeorefStatus(GeorefStatus.UPLOADED);

          // Envoi de l'image au Subject pour mise à jour
          this.georefImageSubject.next(newGeorefImage);
        };

        // Vérifier si le chargement a duré au moins 1s
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minLoadingTime) {
          setTimeout(finishLoading, minLoadingTime - elapsedTime);
        } else {
          finishLoading();
        }
      };

      img.src = imageUrl;
    };

    reader.readAsDataURL(file);
  }

  createGeorefImage(file: File, imageUrl: string): GeorefImage {
    return {
      imageFile: file,
      filenameOriginal: file.name,
      originalFilePath: imageUrl,
      status: GeorefStatus.PENDING,
      uploadingDate: new Date(Date.now()),
      settings: {
        srid: SRID.WEB_MERCATOR,
        resamplingMethod: ResamplingMethod.NEAREST,
        compressionType: CompressionType.NONE,
        transformationType: TransformationType.POLYNOMIAL_1,
        outputFilename: ''
      }
    };
  }

  clearGeorefImage(): void {
    this.georefImageSubject.next({} as GeorefImage);
  }

  createImageLayer(): ImageLayer<ImageSource> {
    this.imageLayer = new ImageLayer({
      source: new Static({
        url: this.georefImageSubject.getValue().originalFilePath!,
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
    const baseStyle = this.gcpService.gcpStyles[(index - 1) % 10]; // Récupère la base

    // Crée une copie indépendante du style pour éviter les conflits
    const newStyle = new Style({
      image: baseStyle.getImage()!, // Réutilise l'icône du style
      fill: baseStyle.getFill()!,
      stroke: baseStyle.getStroke()!,
      text: new Text({
        text: index.toString(),
        font: '12px Arial',
        fill: new Fill({ color: colors[(index - 1) % 10].text }),
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

  createGcpLayer(): VectorLayer {
    const feature = new Feature({
      geometry: new Point([this.x, this.y + this.imageHeight])
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

  deleteLastGcpLayer(): number {
    const size = this.imageLayers.size;
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>(this.imageLayers);
    if (size > 0) {
      newImageLayers.delete(size);
      this.imageLayers = newImageLayers;
      this.imageLayersSubject.next(this.imageLayers);
    }
    return size;
  }

  deleteGcpLayer(index: number): void {
    const layerToRemove = this.imageLayers.get(index);
    if (!layerToRemove) return;

    this.imageLayers.delete(index);
    const newImageLayers = this.reindex();
    this.imageLayers = newImageLayers;
    this.imageLayersSubject.next(this.imageLayers);
  }

  clearAllGcpLayers(): void {
    for (; this.imageLayers.size > 0;) {
      this.deleteGcpLayer(this.imageLayers.size);
    }
  }

  updateGcpPosition(index: number, sourceX: number, sourceY: number): void {
    const gcpLayer = this.imageLayers.get(index);
    if (gcpLayer) {
      // Mettre à jour la position de la couche (exemple avec OpenLayers)
      const feature = gcpLayer.getSource()?.getFeatures()[0];
      if (feature) {
        feature.setGeometry(new Point([sourceX, sourceY + this.imageHeight]));
      }
    }
  }

  updateGeorefStatus(status: GeorefStatus): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.status = status;
    this.georefImageSubject.next(currentImage);
  }

  updateTotalRMSE(newValue: number): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.totalRMSE = newValue;
    this.georefImageSubject.next(currentImage);
  }

  updateGeorefDate(lastGeorefDate: Date): void {
    const currentImage = this.georefImageSubject.getValue();
    currentImage.lastGeoreferencingDate = lastGeorefDate;
    this.georefImageSubject.next(currentImage);
  }
}
