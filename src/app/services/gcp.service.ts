import { Injectable } from '@angular/core';
import { GCP } from '../interfaces/gcp';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GcpService {


  private gcps: GCP[] = [];
  private gcpsSubject = new BehaviorSubject<GCP[]>(this.gcps);
  newGcp: GCP = { index: 0, sourceX: 0, sourceY: 0 };
  x!: number;
  y!: number;

  gcps$ = this.gcpsSubject.asObservable(); // Observable pour suivre les changements
  isAddingGCP = false; // Gère l'ajout de points de contrôle

  addGCP(x: number, y: number) {
    const newGCP: GCP = {
      index: this.gcps.length + 1,
      sourceX: x,
      sourceY: y
    };
    this.gcps.push(newGCP);
    this.gcpsSubject.next(this.gcps); // Notifier les abonnés du changement
    console.log(`🟢 GCP ajouté: ID=${newGCP.index}, X=${newGCP.sourceX}, Y=${newGCP.sourceY}`);

    this.isAddingGCP = false; // Désactiver le mode d'ajout
  }

  getGCPs() {
    return this.gcps;
  }

  toggleAddingGcp() {
    this.isAddingGCP = !this.isAddingGCP;
    if (this.isAddingGCP) {
      this.isAddingGCP = true;
      console.log("Mode d'ajout de GCP activé. Cliquez sur l'image pour fixer un point.");
    }
  }

  addGcpToTable(gcp: GCP) {
    this.gcps.push(gcp);
    this.gcpsSubject.next(this.gcps);
  } 

}
