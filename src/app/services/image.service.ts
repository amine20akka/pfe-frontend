import { Injectable } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { Image as ImageLayer } from 'ol/layer';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import { getCenter } from 'ol/extent';
import Static from 'ol/source/ImageStatic';
import { fromLonLat, Projection } from 'ol/proj';
import { BehaviorSubject } from 'rxjs';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  map!: Map;
  isDragging = false;
  isImageLoaded = false;
  cursorCoordinates = new BehaviorSubject<{ x: number; y: number }>({ x: 0, y: 0 });
  imageWidth = 1000; // Valeurs par défaut avant chargement
  imageHeight = 1000;

  private newGcpLayer!: VectorLayer<VectorSource>; // Couche OpenLayers pour les points de contrôle
  private imageUrl = '';
  private extent = [0, 0, this.imageWidth, this.imageHeight];

  zoomIn() {
    const view = this.map.getView();
    view.animate({
      zoom: view.getZoom()! + 1,  // Augmente le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }
  
  zoomOut() {
    const view = this.map.getView();
    view.animate({
      zoom: view.getZoom()! - 1,  // Diminue le zoom
      duration: 300 // Durée de l'animation (500ms)
    });
  }  

  resetView() {
    if (this.map) {
      const view = this.map.getView();
      view.animate({
        center: getCenter(this.extent), // Recentre sur l’image
        zoom: 1, // Zoom initial
        duration: 300 // Animation fluide
      });
    }
  }
  

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.handleFile(input.files[0]);
    }
  }

  resetImage() {
    this.isImageLoaded = false;
    this.imageUrl = '';
    this.imageWidth = 1000;
    this.imageHeight = 1000;
    this.extent = [0, 0, this.imageWidth, this.imageHeight];
    this.map.setTarget('');
    this.cursorCoordinates.next({ x: 0, y: 0 });
  }

  private handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      console.error('Format non supporté');
      return;
    }

    this.isImageLoaded = true;
    const reader = new FileReader();

    reader.onload = () => {
      this.imageUrl = URL.createObjectURL(file);
      console.log('URL créée :', this.imageUrl);

      // Charger l'image pour récupérer ses dimensions réelles
      const img = new Image();
      img.onload = () => {
        this.imageWidth = img.width;
        this.imageHeight = img.height;
        this.extent = [0, 0, this.imageWidth, this.imageHeight];
        console.log(`Dimensions de l'image: ${this.imageWidth}x${this.imageHeight}`);
      };
      img.src = this.imageUrl;
    };

    reader.readAsDataURL(file);
  }

  initImageLayer() {
    setTimeout(() => {
      this.map = new Map({
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
        const invertedY = this.imageHeight - Math.round(coords[1]); // Inversion de Y
        this.cursorCoordinates.next({ x: Math.round(coords[0]), y: invertedY });
      });

    }, 100); // Petit délai pour s'assurer que le DOM est prêt
  }

  private getGcpStyle(index: number) {
    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: 'red' }),
        stroke: new Stroke({ color: 'white', width: 2 })
      }),
      text: new Text({
        text: index.toString(),
        font: '8px Arial',
        fill: new Fill({ color: 'black' }),
        stroke: new Stroke({ color: 'white', width: 2 }),
        offsetY: -12
      })
    });
  }

  createGcpLayer(index: number): VectorLayer {
    const feature = new Feature({
      geometry: new Point(fromLonLat([this.cursorCoordinates.getValue().x, this.cursorCoordinates.getValue().y])),
      id: index
    });

    this.newGcpLayer = new VectorLayer({
      source: new VectorSource(
        { features: [feature] }
      ),
      style: this.getGcpStyle(index)
    });
    return this.newGcpLayer;
  }

  addGcpLayer(index: number) {
    this.map.addLayer(this.createGcpLayer(index));
  }
}
