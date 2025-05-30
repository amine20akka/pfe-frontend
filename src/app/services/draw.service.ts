import { Injectable } from '@angular/core';
import { Draw, Modify, Snap } from 'ol/interaction';
import { Vector as VectorLayer } from 'ol/layer';
import { MapService } from './map.service';
import { BehaviorSubject } from 'rxjs';
import { DrawMode } from '../interfaces/draw-mode';
import { DrawApiService } from './draw-api.service';

@Injectable({
  providedIn: 'root'
})
export class DrawService {

  drawedLayers: VectorLayer[] = [];
  private activeDrawToolSubject = new BehaviorSubject<DrawMode | null>(null);
  private isDrawingSubject = new BehaviorSubject<boolean>(false);
  activeDrawTool$ = this.activeDrawToolSubject.asObservable();
  isDrawing$ = this.isDrawingSubject.asObservable();

  private modifyInteraction: Modify | undefined;
  private drawInteraction: Draw | undefined;
  private snapInteraction: Snap | undefined;

  constructor(
    private mapService: MapService,
    private drawApiService: DrawApiService,
  ) { }

  // Activer l'outil de dessin sélectionné
  activateDrawingTool(): void {
    this.clearDrawInteractions();
  }

  clearDrawInteractions(): void {
    if (this.mapService.getMap()) {
      if (this.drawInteraction) {
        this.mapService.removeInteractionFromMap(this.drawInteraction);
        this.drawInteraction = undefined;
      }
      if (this.modifyInteraction) {
        this.mapService.removeInteractionFromMap(this.modifyInteraction);
        this.modifyInteraction = undefined;
      }
      if (this.snapInteraction) {
        this.mapService.removeInteractionFromMap(this.snapInteraction);
        this.snapInteraction = undefined;
      }
    }
    this.updateActiveDrawTool(null);
  }

  stopDrawing(): void {
    this.clearDrawInteractions();
  }

  updateDrawingStatus(isDrawing: boolean): void {
    this.isDrawingSubject.next(isDrawing);
  }

  updateActiveDrawTool(toolType: DrawMode | null): void {
    this.activeDrawToolSubject.next(toolType);
  }
}