import { Injectable } from '@angular/core';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { Image as ImageLayer } from 'ol/layer';
import { defaults as defaultControls } from 'ol/control';
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
  private gcpLayerSubject = new BehaviorSubject<Map<number, VectorLayer<VectorSource>>>(this.imageLayers);
  private newGcpLayer!: VectorLayer<VectorSource>; // Couche OpenLayers pour les points de contrôle
  private imageUrl = '';

  map!: OLMap;
  imageLayers$ = this.gcpLayerSubject; // Observable pour suivre les changements
  isDragging = false;
  isImageLoaded = false;
  imageWidth = 0; // Valeurs par défaut avant chargement
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

  zoomIn(): void {
    const view = this.map.getView();
    view.animate({
      zoom: view.getZoom()! + 1,  // Augmente le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }

  zoomOut(): void {
    const view = this.map.getView();
    view.animate({
      zoom: view.getZoom()! - 1,  // Diminue le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }

  resetView(): void {
    if (this.map) {
      const view = this.map.getView();
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
    this.map.setTarget('');
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

  initImageLayer(): void {
    setTimeout(() => {
      this.map = new OLMap({
        target: 'image-map',
        interactions: defaultInteractions(),
        view: new View({
          projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.extent }),
          showFullExtent: true,
          center: getCenter(this.extent),
          zoom: 1
        }),
        layers: [
          new ImageLayer({
            source: new Static({
              url: this.imageUrl,
              imageExtent: this.extent,
              projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: this.extent })
            })
          })
        ],
        controls: defaultControls({ zoom: false, attribution: false, rotate: false })
      });

      this.map.on('pointermove', (event) => {
        const coords = event.coordinate;
        const invertedY = this.imageHeight - parseFloat(coords[1].toFixed(4)); // Inversion de Y avec 4 décimales
        this.gcpService.cursorCoordinates.next({ 
          x: parseFloat(coords[0].toFixed(4)), 
          y: invertedY 
        });
      });      
    }, 100); // Petit délai pour s'assurer que le DOM est prêt
  }

  updateMapLayers(): void {
    // Remove only vector layers
    this.map.getLayers().getArray().forEach((layer) => {
      if (layer instanceof VectorLayer) {
        this.map.removeLayer(layer);
      }
    });

    // After removing, re-add layers
    setTimeout(() => {
      this.imageLayers.forEach((layer, index) => {
        if (!this.map.getLayers().getArray().includes(layer)) {
          layer.setStyle(this.applyLayerStyle(index));
          layer.setVisible(true);
          this.map.addLayer(layer);
          this.map.render();
        }
      });
    }, 700); // Small delay to ensure removal is processed
  }

  private applyLayerStyle(index: number): Style {
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

  createGcpLayer(index: number): VectorLayer {
    const feature = new Feature({
      geometry: new Point([this.x, this.imageHeight - this.y])
    });

    const pointStyle = this.applyLayerStyle(index);

    this.newGcpLayer = new VectorLayer({
      source: new VectorSource(
        { features: [feature] }
      ),
      extent: this.extent,
      style: pointStyle,
    });
    this.newGcpLayer.setVisible(true);
    this.newGcpLayer.setZIndex(1000);

    this.imageLayers.set(index, this.newGcpLayer);
    this.gcpLayerSubject.next(this.imageLayers);
    return this.newGcpLayer;
  }

  addToImage(layer: VectorLayer): void {
    this.map.addLayer(layer);
  }

  deleteGcpLayer(index: number): void {
    // Récupérer la couche à supprimer
    const layerToRemove = this.imageLayers.get(index);
    if (!layerToRemove) return;

    // Supprimer la couche de la carte
    this.map.removeLayer(layerToRemove);
    this.imageLayers.delete(index);

    // Réindexer les GCPs dans gcpLayers
    const newImageLayers = new Map<number, VectorLayer<VectorSource>>();
    let newIndex = 1;
    this.imageLayers.forEach((layer) => {
      newImageLayers.set(newIndex++, layer);
    });

    this.imageLayers = newImageLayers;
    this.gcpLayerSubject.next(this.imageLayers);
    this.updateMapLayers();
  }
  
}
