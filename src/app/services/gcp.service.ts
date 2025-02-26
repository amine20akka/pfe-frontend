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
  gcpStyles: Style[] = [];
  isAddingGCP = false; // Gère l'ajout de points de contrôle

  constructor() {
    this.initGcpStyles();
  }

  createGCP(sourceX: number, sourceY: number, mapX: number, mapY: number): GCP {
    const newGCP: GCP = {
      index: this.gcps.length + 1,
      sourceX: sourceX,
      sourceY: sourceY,
      mapX: mapX,
      mapY: mapY,
    };

    return newGCP;
  }

  getGCPs(): GCP[] {
    return this.gcps;
  }

  clearGCPs(): void {
    this.gcpsSubject.next([]);
  }

  toggleAddingGcp(): void {
    this.isAddingGCP = !this.isAddingGCP;
  }

  addGcpToList(gcp: GCP): void {
    this.gcps.push(gcp);
    this.gcpsSubject.next(this.gcps);
  }

  deleteGcpData(index: number): void {
    this.gcps = this.gcps.filter(gcp => gcp.index !== index); // Supprimer le GCP
    this.gcps.forEach((gcp, i) => gcp.index = i + 1); // Réindexer les GCPs
    this.gcpsSubject.next(this.gcps);
  }

  updateGcp(updatedGcp: GCP): void {
    const index = this.gcps.findIndex(gcp => gcp.index === updatedGcp.index);
    if (index !== -1) {
      this.gcps[index] = updatedGcp;
      this.gcpsSubject.next(this.gcps);
    }
  }

  private initGcpStyles(): void {
    for (let i = 0; i < 10; i++) {
      this.gcpStyles.push(new Style({
        image: new CircleStyle({
          radius: 10, // Augmentez le rayon pour agrandir les points
          fill: new Fill({ color: colors[i].fill }),
        })
      }));
    }
  }

  /**
 * Calcule le résidu pour chaque point de contrôle (GCP)
 * @param transformationMatrix La matrice de transformation utilisée pour la transformation des coordonnées
 */
  private calculateResiduals(transformationMatrix: number[]): void {
    // Vérifier qu'il y a suffisamment de GCPs pour calculer les résidus
    if (this.gcps.length < 3) {
      console.warn('Au moins 3 points de contrôle sont nécessaires pour calculer les résidus');
      return;
    }

    // Pour chaque GCP
    this.gcps.forEach(gcp => {
      // Calculer les coordonnées transformées du point source avec la matrice de transformation
      const transformedX = transformationMatrix[0] * gcp.sourceX + transformationMatrix[1] * gcp.sourceY + transformationMatrix[2];
      const transformedY = transformationMatrix[3] * gcp.sourceX + transformationMatrix[4] * gcp.sourceY + transformationMatrix[5];

      // Calculer la différence entre les coordonnées transformées et les coordonnées cibles (mapX, mapY)
      if (gcp.mapX !== undefined && gcp.mapY !== undefined) {
        const deltaX = gcp.mapX - transformedX;
        const deltaY = gcp.mapY - transformedY;

        // Calculer le résidu comme la distance euclidienne entre les points
        gcp.residual = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      }
    });

    // Notifier les abonnés des changements
    this.gcpsSubject.next(this.gcps);
  }

  /**
 * Calcule la matrice de transformation affine à partir des points de contrôle
 * @returns Un tableau contenant les 6 paramètres de la transformation affine
 */
  private calculateTransformationMatrix(): number[] {
    // Vérifier qu'il y a suffisamment de GCPs pour calculer la transformation
    if (this.gcps.length < 3) {
      return [1, 0, 0, 0, 1, 0]; // Retourner la matrice identité par défaut
    }

    // Méthode des moindres carrés pour une transformation affine
    // Préparer les matrices pour le calcul
    const n = this.gcps.length;
    let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
    let sumMapX = 0, sumMapY = 0, sumXMapX = 0, sumYMapX = 0, sumXMapY = 0, sumYMapY = 0;

    // Accumuler les sommes nécessaires
    this.gcps.forEach(gcp => {
      if (gcp.mapX !== undefined && gcp.mapY !== undefined) {
        sumX += gcp.sourceX;
        sumY += gcp.sourceY;
        sumXX += gcp.sourceX * gcp.sourceX;
        sumYY += gcp.sourceY * gcp.sourceY;
        sumXY += gcp.sourceX * gcp.sourceY;
        sumMapX += gcp.mapX;
        sumMapY += gcp.mapY;
        sumXMapX += gcp.sourceX * gcp.mapX;
        sumYMapX += gcp.sourceY * gcp.mapX;
        sumXMapY += gcp.sourceX * gcp.mapY;
        sumYMapY += gcp.sourceY * gcp.mapY;
      }
    });

    // Résoudre le système d'équations pour les paramètres a, b, c, d, e, f
    const denominator = n * sumXX * sumYY + 2 * sumX * sumY * sumXY - sumXX * sumY * sumY - sumYY * sumX * sumX - n * sumXY * sumXY;

    if (Math.abs(denominator) < 1e-10) {
      console.error('Matrice singulière, impossible de calculer la transformation');
      return [1, 0, 0, 0, 1, 0]; // Retourner la matrice identité en cas d'échec
    }

    // Calculer les coefficients de la transformation affine
    const a = (sumXX * sumYY * sumMapX + sumX * sumY * sumXY * sumMapX + n * sumXY * sumYMapX - sumXX * sumY * sumYMapX - sumYY * sumX * sumXMapX - n * sumXY * sumXMapY) / denominator;
    const b = (n * sumXX * sumYMapX + sumX * sumY * sumXMapX + sumX * sumXY * sumMapX - n * sumXY * sumXMapX - sumXX * sumY * sumMapX - sumX * sumX * sumYMapX) / denominator;
    const c = (sumMapX * sumXX * sumYY + sumXMapX * sumX * sumYY + sumYMapX * sumXY * sumY - sumMapX * sumXY * sumXY - sumXMapX * sumX * sumY * sumY - sumYMapX * sumXX * sumY) / denominator;
    const d = (sumXX * sumYY * sumMapY + sumX * sumY * sumXY * sumMapY + n * sumXY * sumYMapY - sumXX * sumY * sumYMapY - sumYY * sumX * sumXMapY - n * sumXY * sumXMapY) / denominator;
    const e = (n * sumXX * sumYMapY + sumX * sumY * sumXMapY + sumX * sumXY * sumMapY - n * sumXY * sumXMapY - sumXX * sumY * sumMapY - sumX * sumX * sumYMapY) / denominator;
    const f = (sumMapY * sumXX * sumYY + sumXMapY * sumX * sumYY + sumYMapY * sumXY * sumY - sumMapY * sumXY * sumXY - sumXMapY * sumX * sumY * sumY - sumYMapY * sumXX * sumY) / denominator;

    return [a, b, c, d, e, f];
  }

  updateGcpsAndResiduals(): void {
    const transformationMatrix = this.calculateTransformationMatrix();
    this.calculateResiduals(transformationMatrix);
  }
}
