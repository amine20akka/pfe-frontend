import { Injectable } from '@angular/core';
import { Draw, Modify, Snap } from 'ol/interaction';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { Style, Stroke } from 'ol/style';
import { MapService } from './map.service';
import { BehaviorSubject } from 'rxjs';
import { AdvancedDrawMode, DrawMode, SimpleDrawMode } from '../models/draw-mode';

@Injectable({
  providedIn: 'root'
})
export class DrawService {

  drawedLayers: VectorLayer[] = [];
  isDrawing = false;
  activeDrawTool: DrawMode | null = null;
  private drawedLayersSubject = new BehaviorSubject<VectorLayer[]>(this.drawedLayers);
  private isDrawingSubject = new BehaviorSubject<boolean>(this.isDrawing);
  private activeDrawToolSubject = new BehaviorSubject<DrawMode | null>(this.activeDrawTool);
  drawedLayers$ = this.drawedLayersSubject.asObservable();
  isDrawing$ = this.isDrawingSubject.asObservable();
  activeDrawTool$ = this.activeDrawToolSubject.asObservable();

  private source: VectorSource | undefined;
  private drawedLayer: VectorLayer | undefined;
  private drawInteraction: Draw | undefined;
  private modifyInteraction: Modify | undefined;
  private snapInteraction: Snap | undefined;

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
    this.activateDrawing(toolType); // Activer le nouvel outil de dessin
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
      console.log('Simple draw mode activated:', toolType);
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

      // Écouter l'événement de fin de dessin
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

  // Méthode pour arrêter le dessin
  stopDrawing(): void {
    this.updateDrawingStatus(false);
    this.clearDrawInteractions();
  }

  // Méthode pour effacer tous les dessins
  clearDrawings(): void {
    if (this.source) {
      this.source.clear();
    }
  }

  updateDrawingStatus(isDrawing: boolean): void {
    this.isDrawing = isDrawing;
    this.isDrawingSubject.next(isDrawing);
  }

  updateActiveDrawTool(toolType: DrawMode | null): void {
    this.activeDrawTool = toolType;
    this.activeDrawToolSubject.next(toolType);
  }

  addDrawedLayer(layer: VectorLayer): void {
    this.drawedLayers.push(layer);
    this.drawedLayersSubject.next(this.drawedLayers);
  }
}