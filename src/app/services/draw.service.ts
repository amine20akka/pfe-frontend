import { Injectable } from '@angular/core';
import { Draw, Modify, Snap } from 'ol/interaction';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { Style, Stroke } from 'ol/style';
import { MapService } from './map.service';
import { BehaviorSubject } from 'rxjs';
import { AdvancedDrawMode, DrawMode, DrawModes, SimpleDrawMode } from '../models/draw-mode';
import Feature from 'ol/Feature';
import { lineArc, bearing, distance, midpoint, point } from '@turf/turf';
import { LineString } from 'ol/geom';
import { GeometryFunction } from 'ol/interaction/Draw';
import { Coordinate } from 'ol/coordinate';

@Injectable({
  providedIn: 'root'
})
export class DrawService {

  drawedLayers: VectorLayer[] = [];
  private drawedLayersSubject = new BehaviorSubject<VectorLayer[]>(this.drawedLayers);
  private activeDrawToolSubject = new BehaviorSubject<DrawMode | null>(null);
  private isDrawingSubject = new BehaviorSubject<boolean>(false);
  activeDrawTool$ = this.activeDrawToolSubject.asObservable();
  drawedLayers$ = this.drawedLayersSubject.asObservable();
  isDrawing$ = this.isDrawingSubject.asObservable();
  DrawModes = DrawModes;

  private modifyInteraction: Modify | undefined;
  private drawedLayer: VectorLayer | undefined;
  private drawInteraction: Draw | undefined;
  private snapInteraction: Snap | undefined;
  private source: VectorSource | undefined;
  private previewFeature: Feature | undefined;

  constructor(
    private mapService: MapService,
  ) {
    // Initialiser la source et la couche
    this.source = new VectorSource();
    this.drawedLayer = new VectorLayer({
      source: this.source,
      style: new Style({
        stroke: new Stroke({
          color: '#ff0000',
          width: 2
        })
      })
    });
  }

  // Méthode pour vérifier si un outil est simple
  isSimpleDrawMode(mode: DrawMode): mode is SimpleDrawMode {
    return ['Point', 'LineString', 'Polygon', 'Circle'].includes(mode);
  }

  // Méthode pour vérifier si un outil est avancé
  isAdvancedDrawMode(mode: DrawMode): mode is AdvancedDrawMode {
    return ['Arc', 'Tracing', 'Perpendicular', 'TracingBuffer'].includes(mode);
  }

  // Activer l'outil de dessin sélectionné
  activateDrawingTool(toolType: DrawMode): void {
    this.clearDrawInteractions(); // Désactiver l'outil actuel s'il existe

    this.updateDrawingStatus(true); // Mettre à jour l'état de dessin
    this.updateActiveDrawTool(toolType);  // Mettre à jour l'outil actif
    switch (toolType) {
      case DrawModes['ARC']:
        this.activateArcDrawing();
        break;
      case DrawModes['TRACING']:
        // this.activateTracingDrawing();
        break;
      case DrawModes['PERPENDICULAR']:
        // this.activatePerpendicularDrawing();
        break;
      case DrawModes['TRACING_BUFFER']:
        // this.activateTracingBufferDrawing();
        break;
      default:
        this.activateDrawing(toolType); // Activer le nouvel outil de dessin
    }
    this.activateModifyInteraction();
    this.activateSnapInteraction();
  }

  // Désactiver les interactions de dessin
  clearDrawInteractions(): void {
    if (this.mapService.getMap()) {
      if (this.drawInteraction) {
        this.mapService.removeInteraction(this.drawInteraction);
        this.drawInteraction = undefined;
      }
      if (this.modifyInteraction) {
        this.mapService.removeInteraction(this.modifyInteraction);
        this.modifyInteraction = undefined;
      }
      if (this.snapInteraction) {
        this.mapService.removeInteraction(this.snapInteraction);
        this.snapInteraction = undefined;
      }
    }
    this.updateDrawingStatus(false); // Mettre à jour l'état de dessin
    this.updateActiveDrawTool(null); // Réinitialiser l'outil actif
  }

  // Activer le dessin
  private activateDrawing(toolType: DrawMode): void {
    if (!this.mapService.getMap() || !this.source) return;

    if (this.isSimpleDrawMode(toolType)) {
      this.drawInteraction = new Draw({
        source: this.source,
        type: toolType,
        // style: new Style({
        //   stroke: new Stroke({
        //     color: '#0099ff',
        //     width: 2
        //   })
        // })
      });

      this.mapService.addInteraction(this.drawInteraction);

      this.drawInteraction.on('drawend', () => {
        this.addDrawedLayer(this.drawedLayer!);
      });
    }
  }

  activateModifyInteraction(): void {
    this.modifyInteraction = new Modify({
      source: this.source
    });
    this.mapService.addInteraction(this.modifyInteraction);
  }

  activateSnapInteraction(): void {
    this.snapInteraction = new Snap({
      source: this.source
    });
    this.mapService.addInteraction(this.snapInteraction);
  }

  activateArcDrawing(): void {
    if (!this.mapService.getMap() || !this.source) return;
  
    this.drawInteraction = new Draw({
      source: this.source,
      type: 'LineString',
      maxPoints: 3,
      geometryFunction: this.arcGeometryFunction
    });
  
    this.mapService.addInteraction(this.drawInteraction);
  
    this.drawInteraction.on('drawend', () => {
      this.addDrawedLayer(this.drawedLayer!);
    });
  }
  
  arcGeometryFunction: GeometryFunction = (coordinates, geometry) => {
    if (coordinates.length < 2) {
      return new LineString(coordinates.flat(1) as Coordinate[]); // rien à dessiner
    }
  
    const start = coordinates[0];
    const end = coordinates.length >= 2 ? coordinates[1] : coordinates[0];
    const control = coordinates.length >= 3 ? coordinates[2] : coordinates[1];
  
    if (!start || !end || !control) {
      return new LineString([start as Coordinate, end as Coordinate]);
    }
  
    // Calcul du centre
    const turfStart = point(start as Coordinate);
    const turfEnd = point(end as Coordinate);
    const turfControl = point(control as Coordinate);
    const turfMid = midpoint(turfStart, turfEnd);
    const center = turfMid.geometry.coordinates;
    const radius = distance(turfStart, turfControl);
    const startAngle = bearing(center, start as Coordinate);
    const endAngle = bearing(center, end as Coordinate);
  
    const arc = lineArc(center, radius, startAngle, endAngle, { steps: 64 });
    const arcCoords = arc.geometry.coordinates;
  
    if (!geometry) geometry = new LineString([]);
    geometry.setCoordinates(arcCoords);
    return geometry;
  };  

  stopDrawing(): void {
    this.updateDrawingStatus(false);
    this.clearDrawInteractions();
  }

  clearDrawing(): void {
    if (this.source) {
      this.source.clear();
    }
  }

  updateDrawingStatus(isDrawing: boolean): void {
    this.isDrawingSubject.next(isDrawing);
  }

  updateActiveDrawTool(toolType: DrawMode | null): void {
    this.activeDrawToolSubject.next(toolType);
  }

  addDrawedLayer(layer: VectorLayer): void {
    this.drawedLayers.push(layer);
    this.drawedLayersSubject.next(this.drawedLayers);
  }
}