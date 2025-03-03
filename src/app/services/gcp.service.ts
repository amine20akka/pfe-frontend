import { Injectable } from '@angular/core';
import { GCP } from '../interfaces/gcp';
import { BehaviorSubject } from 'rxjs';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import { colors } from '../shared/colors';
import { TransformationType, GeorefSettings, CompressionType, ResamplingMethod, SRID } from '../interfaces/georef-settings';
import { GeorefSettingsService } from './georef-settings.service';

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

  // Variables pour la transformation et les résidus
  private transformCoefficients: number[][] = []; // Coefficients de transformation
  private totalRMSE = 0; // RMSE global

  // Paramètres de géoréférencement par défaut
  private georefSettings: GeorefSettings = {
    transformationType: TransformationType.POLYNOMIAL_1,
    srid: SRID.WEB_MERCATOR, // WGS84 - WEB_MERCATOR par défaut
    resamplingMethod: ResamplingMethod.BILINEAR,
    compressionType: CompressionType.NONE,
    outputFilename: 'output.tif'
  };

  constructor(
    private georefSettingsService: GeorefSettingsService
  ) {
    this.initGcpStyles();
    this.georefSettingsService.transformationType$.subscribe((type) => {
      this.georefSettings.transformationType = type;
    })
    this.georefSettingsService.srid$.subscribe((srid) => {
      this.georefSettings.srid = srid;
    })
    this.georefSettingsService.resamplingMethod$.subscribe((method) => {
      this.georefSettings.resamplingMethod = method;
    })
    this.georefSettingsService.compressionType$.subscribe((type) => {
      this.georefSettings.compressionType = type;
    })
    this.georefSettingsService.outputFilename$.subscribe((filename) => {
      this.georefSettings.outputFilename = filename;
    })
  }

  getGeorefSettings(): GeorefSettings {
    return this.georefSettings;
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
    return this.gcpsSubject.getValue();
  }

  clearGCPs(): void {
    this.gcps = [];
    this.gcpsSubject.next([]);
    this.transformCoefficients = [];
    this.totalRMSE = 0;
  }

  toggleAddingGcp(): void {
    this.isAddingGCP = !this.isAddingGCP;
  }

  addGcpToList(gcp: GCP): void {
    this.gcps.push(gcp);
    if (this.hasEnoughGCPs()) {
      this.calculateTransformation();
      this.calculateResiduals();
    }
    this.gcpsSubject.next(this.gcps);
  }

  deleteGcpData(index: number): void {
    this.gcps = this.gcps.filter(gcp => gcp.index !== index); // Supprimer le GCP
    this.gcps.forEach((gcp, i) => gcp.index = i + 1); // Réindexer les GCPs

    // Recalculer la transformation et les résidus si suffisamment de points
    this.updateResiduals();

    this.gcpsSubject.next(this.gcps);
  }

  updateGcp(updatedGcp: GCP): void {
    const index = this.gcps.findIndex(gcp => gcp.index === updatedGcp.index);
    if (index !== -1) {
      this.gcps[index] = updatedGcp;

      // Recalculer la transformation et les résidus
      this.updateResiduals();

      this.gcpsSubject.next(this.gcps);
    }
  }

  /**
   * Vérifie s'il y a suffisamment de GCPs pour le type de transformation choisi
   */
  private hasEnoughGCPs(): boolean {
    const minPoints = this.getMinimumPointsRequired();
    return this.gcps.length >= minPoints;
  }

  /**
   * Détermine le nombre minimum de points nécessaires en fonction du type de transformation
   */
  private getMinimumPointsRequired(): number {
    switch (this.georefSettings.transformationType) {
      case TransformationType.POLYNOMIAL_1:
        return 3; // Polynomiale du 1er degré (affine) : 3 points minimum
      case TransformationType.POLYNOMIAL_2:
        return 6; // Polynomiale du 2ème degré : 6 points minimum
      case TransformationType.POLYNOMIAL_3:
        return 10; // Polynomiale du 3ème degré : 10 points minimum
      default:
        return 3;
    }
  }

  /**
   * Calcule la transformation polynomiale basée sur les points de contrôle
   */
  calculateTransformation(): void {
    if (!this.hasEnoughGCPs()) {
      return;
    }

    try {
      switch (this.georefSettings.transformationType) {
        case TransformationType.POLYNOMIAL_1:
          this.calculatePolynomial1Transformation();
          break;
        case TransformationType.POLYNOMIAL_2:
          this.calculatePolynomial2Transformation();
          break;
        case TransformationType.POLYNOMIAL_3:
          this.calculatePolynomial3Transformation();
          break;
        default:
          this.calculatePolynomial1Transformation();
      }
    } catch (e) {
      console.error("Erreur lors du calcul de la transformation:", e);
      this.transformCoefficients = [];
    }
  }

  /**
   * Calcule une transformation polynomiale du 1er degré (affine)
   * x' = a0 + a1*x + a2*y
   * y' = b0 + b1*x + b2*y
   */
  private calculatePolynomial1Transformation(): void {
    // Construction de la matrice A et des vecteurs bx, by
    const A: number[][] = [];
    const bx: number[] = [];
    const by: number[] = [];

    this.gcps.forEach(gcp => {
      if (gcp.mapX !== undefined && gcp.mapY !== undefined) {
        // Pour chaque point, ajoutez une ligne à la matrice A
        A.push([1, gcp.sourceX, gcp.sourceY]);
        bx.push(gcp.mapX);
        by.push(gcp.mapY);
      }
    });

    // Résoudre les systèmes d'équations
    const coeffsX = this.solveLinearSystem(A, bx);
    const coeffsY = this.solveLinearSystem(A, by);

    // Stocker les coefficients
    this.transformCoefficients = [coeffsX, coeffsY];
  }

  /**
   * Calcule une transformation polynomiale du 2ème degré
   * x' = a0 + a1*x + a2*y + a3*x² + a4*x*y + a5*y²
   * y' = b0 + b1*x + b2*y + b3*x² + b4*x*y + b5*y²
   */
  private calculatePolynomial2Transformation(): void {
    // Construction de la matrice A et des vecteurs bx, by
    const A: number[][] = [];
    const bx: number[] = [];
    const by: number[] = [];

    this.gcps.forEach(gcp => {
      if (gcp.mapX !== undefined && gcp.mapY !== undefined) {
        const x = gcp.sourceX;
        const y = gcp.sourceY;
        const x2 = x * x;
        const y2 = y * y;
        const xy = x * y;

        // Pour chaque point, ajoutez une ligne à la matrice A
        A.push([1, x, y, x2, xy, y2]);
        bx.push(gcp.mapX);
        by.push(gcp.mapY);
      }
    });

    // Résoudre les systèmes d'équations
    const coeffsX = this.solveLinearSystem(A, bx);
    const coeffsY = this.solveLinearSystem(A, by);

    // Stocker les coefficients
    this.transformCoefficients = [coeffsX, coeffsY];
  }

  /**
   * Calcule une transformation polynomiale du 3ème degré
   * x' = a0 + a1*x + a2*y + a3*x² + a4*x*y + a5*y² + a6*x³ + a7*x²*y + a8*x*y² + a9*y³
   * y' = b0 + b1*x + b2*y + b3*x² + b4*x*y + b5*y² + b6*x³ + b7*x²*y + b8*x*y² + b9*y³
   */
  private calculatePolynomial3Transformation(): void {
    // Construction de la matrice A et des vecteurs bx, by
    const A: number[][] = [];
    const bx: number[] = [];
    const by: number[] = [];

    this.gcps.forEach(gcp => {
      if (gcp.mapX !== undefined && gcp.mapY !== undefined) {
        const x = gcp.sourceX;
        const y = gcp.sourceY;
        const x2 = x * x;
        const y2 = y * y;
        const xy = x * y;
        const x3 = x2 * x;
        const y3 = y2 * y;
        const x2y = x2 * y;
        const xy2 = x * y2;

        // Pour chaque point, ajoutez une ligne à la matrice A
        A.push([1, x, y, x2, xy, y2, x3, x2y, xy2, y3]);
        bx.push(gcp.mapX);
        by.push(gcp.mapY);
      }
    });

    // Résoudre les systèmes d'équations
    const coeffsX = this.solveLinearSystem(A, bx);
    const coeffsY = this.solveLinearSystem(A, by);

    // Stocker les coefficients
    this.transformCoefficients = [coeffsX, coeffsY];
  }

  /**
   * Résout un système d'équations linéaires en utilisant la méthode des moindres carrés
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    // Calcul de A^T (transposée de A)
    const AT: number[][] = [];
    for (let j = 0; j < A[0].length; j++) {
      AT[j] = [];
      for (let i = 0; i < A.length; i++) {
        AT[j][i] = A[i][j];
      }
    }

    // Calcul de A^T * A
    const ATA: number[][] = [];
    for (let i = 0; i < AT.length; i++) {
      ATA[i] = [];
      for (let j = 0; j < A[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < A.length; k++) {
          sum += AT[i][k] * A[k][j];
        }
        ATA[i][j] = sum;
      }
    }

    // Calcul de A^T * b
    const ATb: number[] = [];
    for (let i = 0; i < AT.length; i++) {
      let sum = 0;
      for (let j = 0; j < AT[0].length; j++) {
        sum += AT[i][j] * b[j];
      }
      ATb[i] = sum;
    }

    // Résoudre le système ATA * x = ATb
    return this.gaussianElimination(ATA, ATb);
  }

  /**
   * Implémentation de l'élimination gaussienne pour résoudre Ax = b
   */
  private gaussianElimination(A: number[][], b: number[]): number[] {
    const n = A.length;
    const augmented: number[][] = [];

    // Créer la matrice augmentée [A|b]
    for (let i = 0; i < n; i++) {
      augmented[i] = [...A[i], b[i]];
    }

    // Élimination vers l'avant
    for (let i = 0; i < n; i++) {
      // Recherche du pivot maximum
      let maxRow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = j;
        }
      }

      // Échanger les lignes
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Élimination
      for (let j = i + 1; j < n; j++) {
        const factor = augmented[j][i] / augmented[i][i];
        for (let k = i; k <= n; k++) {
          augmented[j][k] -= factor * augmented[i][k];
        }
      }
    }

    // Substitution inverse
    const x: number[] = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += augmented[i][j] * x[j];
      }
      x[i] = (augmented[i][n] - sum) / augmented[i][i];
    }

    return x;
  }

  /**
   * Calcule les coordonnées transformées pour un point source
   */
  private transformCoordinates(sourceX: number, sourceY: number): { x: number, y: number } {
    if (this.transformCoefficients.length === 0) {
      return { x: 0, y: 0 };
    }

    const coeffsX = this.transformCoefficients[0];
    const coeffsY = this.transformCoefficients[1];

    let transformedX = 0;
    let transformedY = 0;

    switch (this.georefSettings.transformationType) {
      case TransformationType.POLYNOMIAL_1:
        transformedX = coeffsX[0] + coeffsX[1] * sourceX + coeffsX[2] * sourceY;
        transformedY = coeffsY[0] + coeffsY[1] * sourceX + coeffsY[2] * sourceY;
        break;

      case TransformationType.POLYNOMIAL_2: {
        const x2 = sourceX * sourceX;
        const y2 = sourceY * sourceY;
        const xy = sourceX * sourceY;

        transformedX = coeffsX[0] + coeffsX[1] * sourceX + coeffsX[2] * sourceY +
          coeffsX[3] * x2 + coeffsX[4] * xy + coeffsX[5] * y2;
        transformedY = coeffsY[0] + coeffsY[1] * sourceX + coeffsY[2] * sourceY +
          coeffsY[3] * x2 + coeffsY[4] * xy + coeffsY[5] * y2;
        break;
      }

      case TransformationType.POLYNOMIAL_3: {
        const x2_3 = sourceX * sourceX;
        const y2_3 = sourceY * sourceY;
        const xy_3 = sourceX * sourceY;
        const x3 = x2_3 * sourceX;
        const y3 = y2_3 * sourceY;
        const x2y = x2_3 * sourceY;
        const xy2 = sourceX * y2_3;

        transformedX = coeffsX[0] + coeffsX[1] * sourceX + coeffsX[2] * sourceY +
          coeffsX[3] * x2_3 + coeffsX[4] * xy_3 + coeffsX[5] * y2_3 +
          coeffsX[6] * x3 + coeffsX[7] * x2y + coeffsX[8] * xy2 + coeffsX[9] * y3;
        transformedY = coeffsY[0] + coeffsY[1] * sourceX + coeffsY[2] * sourceY +
          coeffsY[3] * x2_3 + coeffsY[4] * xy_3 + coeffsY[5] * y2_3 +
          coeffsY[6] * x3 + coeffsY[7] * x2y + coeffsY[8] * xy2 + coeffsY[9] * y3;
        break;
      }
    }

    return { x: transformedX, y: transformedY };
  }

  /**
   * Calcule les résidus pour chaque point de contrôle
   */
  calculateResiduals(): void {
    if (this.transformCoefficients.length === 0 || !this.hasEnoughGCPs()) {
      return;
    }

    let sumSquaredResiduals = 0;

    // Pour chaque point de contrôle
    this.gcps.forEach(gcp => {
      if (gcp.mapX === undefined || gcp.mapY === undefined) {
        return;
      }

      // Calculer les coordonnées transformées
      const transformed = this.transformCoordinates(gcp.sourceX, gcp.sourceY);

      // Calculer l'erreur euclidienne (résidu)
      const dx = transformed.x - gcp.mapX;
      const dy = transformed.y - gcp.mapY;
      const residual = Math.sqrt(dx * dx + dy * dy);

      // Mettre à jour le résidu du point
      gcp.residual = parseFloat(residual.toFixed(3));

      // Ajouter au carré total des résidus
      sumSquaredResiduals += residual * residual;
    });

    // Calculer le RMSE global
    this.totalRMSE = Math.sqrt(sumSquaredResiduals / this.gcps.length);
  }
  
  updateResiduals(): void {
    if (this.hasEnoughGCPs()) {
      this.calculateTransformation();
      this.calculateResiduals();
      this.gcpsSubject.next(this.gcps);
    } else {
      this.transformCoefficients = [];
      this.totalRMSE = 0;
      // Réinitialiser les résidus
      this.gcps.forEach(gcp => gcp.residual = undefined);
    }
  }

  /**
   * Retourne le RMSE global pour tous les points
   */
  getTotalRMSE(): number {
    return parseFloat(this.totalRMSE.toFixed(3));
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
}