import { Injectable } from '@angular/core';
import { GCP } from '../interfaces/gcp';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GcpService {

  isAddingGCP = false; // Gère l'ajout de points de contrôle
  private gcps: GCP[] = [];
  private gcpsSubject = new BehaviorSubject<GCP[]>(this.gcps);

  gcps$ = this.gcpsSubject.asObservable(); // Observable pour suivre les changements

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

  handleStartAddingGCP() {
    this.isAddingGCP = true;
    console.log("Mode d'ajout de GCP activé. Cliquez sur l'image pour fixer un point.");
  }
  
}
