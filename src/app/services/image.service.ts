import { Injectable } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { Image as ImageLayer } from 'ol/layer';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import { getCenter } from 'ol/extent';
import Static from 'ol/source/ImageStatic';
import { Projection } from 'ol/proj';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  map!: Map;
  imageUrl: string = '';
  isImageLoaded = false;
  isDragging = false;

  private imageWidth = 1000; // Valeurs par défaut avant chargement
  private imageHeight = 1000;

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

  private handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      console.error('Format non supporté');
      return;
    }

    this.isImageLoaded = true;
    const reader = new FileReader();

    reader.onload = (event: any) => {
      this.imageUrl = URL.createObjectURL(file);
      console.log('URL créée :', this.imageUrl);

      // Charger l'image pour récupérer ses dimensions réelles
      const img = new Image();
      img.onload = () => {
        this.imageWidth = img.width;
        this.imageHeight = img.height;
        console.log(`Dimensions de l'image: ${this.imageWidth}x${this.imageHeight}`);

        // Initialiser OpenLayers après l'obtention des dimensions
        setTimeout(() => this.initImageLayer(), 0);
      };
      img.src = this.imageUrl;
    };

    reader.readAsDataURL(file);
  }

  initImageLayer() {
    const extent = [0, 0, this.imageWidth, this.imageHeight]; // Adapter aux dimensions réelles

    this.map = new Map({
      target: 'image-map',
      interactions: defaultInteractions(),
      view: new View({
        projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: extent }),
        extent: extent,
        center: getCenter(extent), // Centrer l'image
        zoom: 1
      }),
      layers: [
        new ImageLayer({
          source: new Static({
            url: this.imageUrl,
            imageExtent: extent,
            projection: new Projection({ code: 'PIXEL', units: 'pixels', extent: extent })
          })
        })
      ],
      controls: defaultControls({ zoom: false, attribution: false, rotate: false }),
    });

    // Ajuster la vue à l'image
    this.map.getView().fit(extent, { size: this.map.getSize() });
  }
}
