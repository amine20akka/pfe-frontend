import { Injectable } from '@angular/core';
import { GCP } from '../interfaces/gcp';
import { BehaviorSubject } from 'rxjs';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import { colors } from '../shared/colors';

@Injectable({
  providedIn: 'root'
})
export class GcpService {

  private gcps: GCP[] = [];
  private gcpsSubject = new BehaviorSubject<GCP[]>(this.gcps);

  cursorCoordinates = new BehaviorSubject<{ x: number; y: number }>({ x: 0, y: 0 });
  gcps$ = this.gcpsSubject.asObservable(); // Observable pour suivre les changements
  newGcp: GCP = { index: 0, sourceX: 0, sourceY: 0 };
  gcpStyles: Style[] = [];
  isAddingGCP = false; // Gère l'ajout de points de contrôle

  constructor() {
    this.initGcpStyles();
  }

  createGCP(x: number, y: number) {
    const newGCP: GCP = {
      index: this.gcps.length + 1,
      sourceX: x,
      sourceY: y
    };
    
    this.addGcpToTable(newGCP);
    this.toggleAddingGcp(); // Désactiver le mode d'ajout
  }

  getGCPs() {
    return this.gcps;
  }

  clearGCPs() {
    this.gcps = [];
  }

  toggleAddingGcp() {
    this.isAddingGCP = !this.isAddingGCP;
  }

  addGcpToTable(gcp: GCP) {
    this.gcps.push(gcp);
    this.gcpsSubject.next(this.gcps);
  }

  deleteGcpData(index: number) {
    this.gcps = this.gcps.filter(gcp => gcp.index !== index); // Supprimer le GCP
    this.gcps.forEach((gcp, i) => gcp.index = i + 1); // Réindexer les GCPs
    this.gcpsSubject.next(this.gcps);
  }

  private initGcpStyles() {
    for (let i = 0; i < 10; i++) {
      this.gcpStyles.push(new Style({
        image: new CircleStyle({
          radius: 10, // Augmentez le rayon pour agrandir les points
          fill: new Fill({ color: colors[i].fill }),
        })
      }));
    }
  }

}
