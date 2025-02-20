import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeorefService {

  isGeorefActive = false; // Gère l'affichage de la partie droite
  
  toggleGeoref() {
    this.isGeorefActive = !this.isGeorefActive;
  }
}
