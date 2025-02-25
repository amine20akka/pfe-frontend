import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, Observable, switchMap } from 'rxjs';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GcpDialogComponent } from '../components/gcp-dialog/gcp-dialog.component';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import { GcpService } from './gcp.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  
  private map!: Map;
  private mapSubject = new BehaviorSubject<Map | null>(null);
  public map$ = this.mapSubject.asObservable();
  private isMapSelectionSubject = new BehaviorSubject<boolean>(false);
  isMapSelection$ = this.isMapSelectionSubject.asObservable();
  private mapCoordinates = new BehaviorSubject<{ x: number, y: number }>({ x: 0, y: 0 });
  public mapCoordinates$ = this.mapCoordinates.asObservable();

  constructor(
    private dialog: MatDialog,
    private gcpService: GcpService,
  ) {
    // Subscribe to isMapSelection changes
    this.isMapSelection$
      .pipe(
        filter(isSelecting => isSelecting), // Proceed only if selection is active
        switchMap(() => this.selectGcpFromMap()) // Wait for map click
      )
      .subscribe((coords) => {
        if (coords) {
          // Reopen the dialog with selected coordinates
          const dialogRef = this.openGcpDialog(coords.x, coords.y);
          this.isMapSelectionSubject.next(false); // Reset selection state
          
          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.gcpService.createGCP(
                this.gcpService.cursorCoordinates.getValue().x,
                this.gcpService.cursorCoordinates.getValue().y,
                result.mapX,
                result.mapY
              );
            }
          });
        }
      });
  }

  initMap(target: string): void {
    if (!this.map) {
      this.map = new Map({
        target: target,
        interactions: defaultInteractions(),
        layers: [
          new TileLayer({
            source: new OSM()
          })
        ],
        view: new View({
          projection: 'EPSG:3857', // Projection Web Mercator
          center: [0, 0],
          zoom: 3
        }),
        controls: defaultControls({ zoom: false, attribution: false })
      });

      this.mapSubject.next(this.map);

      // Écouter les mouvements du curseur pour récupérer les coordonnées
      this.map.on('pointermove', (event) => {
        const coords = event.coordinate;
        this.mapCoordinates.next({
          x: parseFloat(coords[0].toFixed(4)),
          y: parseFloat(coords[1].toFixed(4))
        });
      });
    } else {
      this.map.setTarget(target);
    }
  }

  getMap(): Map | null {
    return this.mapSubject.getValue(); // Récupération de l'état actuel
  }

  startMapSelection() {
    this.isMapSelectionSubject.next(true); // Activate map selection mode
  }

  selectGcpFromMap(): Observable<{ x: number, y: number }> {
    return new Observable(observer => {
      const mapClickHandler = (event: MapBrowserEvent<MouseEvent>) => {
        const clickedCoord = this.map.getCoordinateFromPixel(event.pixel);
        console.log('Raw : ', clickedCoord);
        // Convert coordinates if necessary
        observer.next({ x: clickedCoord[0], y: clickedCoord[1] });

        // Remove click listener after selecting a point
        this.map.un('click', mapClickHandler);
        observer.complete();
      };

      // Listen for a single map click
      this.map.on('click', mapClickHandler);
    });
  }

  openGcpDialog(x: number, y: number): MatDialogRef<GcpDialogComponent> {
    return this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true,
      data: { x, y }
    });
  }

  // enableMapSelection() {
  //   console.log("Sélection sur la carte activée !");

  //   this.map.on('click', (event) => {
  //     const coords = event.coordinate;
  //     const x = Math.round(coords[0]);
  //     const y = Math.round(coords[1]);

  //     console.log(`GCP ajouté sur la carte : (${x}, ${y})`);
  //   });
  // }

}
