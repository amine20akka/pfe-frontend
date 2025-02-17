import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions, DblClickDragZoom, DragRotateAndZoom } from 'ol/interaction';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: Map;
  
  // Utilisation de BehaviorSubject pour suivre l'état de la carte
  private mapSubject = new BehaviorSubject<Map | null>(null);
  public map$ = this.mapSubject.asObservable();

  initializeMap(target: string): void {
    if (!this.map) { // Empêche la réinitialisation si la carte existe déjà
      this.map = new Map({
        target: target,
        interactions: defaultInteractions().extend([
          new DblClickDragZoom(),
          new DragRotateAndZoom(),
        ]),
        layers: [
          new TileLayer({
            source: new OSM({
              attributions: []
            }),
            properties: { background: true }
          })
        ],
        view: new View({
          center: [0, 0],
          zoom: 3,
          rotation: 0
        }),
        controls: defaultControls({
          zoom: false,
          attribution: false,
          rotate: false,
        })
      });

      this.mapSubject.next(this.map); // Mise à jour de l’état
    } else {
      this.map.setTarget(target); // Associer au DOM si la carte existe déjà
    }
  }

  getMap(): Map | null {
    return this.mapSubject.getValue(); // Récupération de l'état actuel
  }
}
