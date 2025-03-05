import { Injectable } from '@angular/core';
import { GCP } from '../interfaces/gcp';
import { BehaviorSubject } from 'rxjs';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import { colors } from '../shared/colors';
import { TransformationType } from '../interfaces/georef-settings';
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
  private transformationType: TransformationType = TransformationType.POLYNOMIAL_1;

  constructor(
    private georefSettingsService: GeorefSettingsService
  ) {
    this.initGcpStyles();
    this.georefSettingsService.settings$.subscribe((settings) => {
      this.transformationType = settings.transformationType;
    })
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
    this.gcpsSubject.next(this.gcps);
    this.updateResiduals();
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
    switch (this.transformationType) {
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
      switch (this.transformationType) {
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

    switch (this.transformationType) {
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
 * Calcule les résidus pour chaque point de contrôle en pixels.
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

      // Calculer les coordonnées transformées (en pixels)
      const transformedPixel = this.inverseTransformCoordinates(gcp.mapX, gcp.mapY);

      if (!transformedPixel) {
        console.warn("Impossible d'inverser la transformation pour ce GCP.");
        return;
      }

      // Calculer l'erreur euclidienne (résidu) en pixels
      const dx = transformedPixel.x - gcp.sourceX;
      const dy = transformedPixel.y - gcp.sourceY; // Utilisez invertedSourceY si nécessaire
      const residual = Math.sqrt(dx * dx + dy * dy);

      // Mettre à jour le résidu du point
      gcp.residual = parseFloat(residual.toFixed(4));

      // Ajouter au carré total des résidus
      sumSquaredResiduals += residual * residual;
    });

    // Calculer le RMSE global en pixels
    this.totalRMSE = Math.sqrt(sumSquaredResiduals / this.gcps.length);
  }

  /**
   * Inverse la transformation polynomiale pour convertir des coordonnées géographiques en coordonnées pixel.
   * @param mapX Coordonnée X géographique
   * @param mapY Coordonnée Y géographique
   * @returns Coordonnées en pixels ou null si l'inversion échoue
   */
  private inverseTransformCoordinates(mapX: number, mapY: number): { x: number, y: number } | null {
    const maxIterations = 100; // Nombre maximum d'itérations pour la méthode de Newton-Raphson
    const tolerance = 1e-6; // Tolérance pour la convergence

    // Initialisation des valeurs de départ (guess)
    let guessX = 0;
    let guessY = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Calculer les coordonnées géographiques correspondantes aux valeurs de départ
      const transformed = this.transformCoordinates(guessX, guessY);

      // Calculer les erreurs
      const errorX = transformed.x - mapX;
      const errorY = transformed.y - mapY;

      // Vérifier la convergence
      if (Math.abs(errorX) < tolerance && Math.abs(errorY) < tolerance) {
        return { x: guessX, y: guessY };
      }

      // Calculer la matrice jacobienne
      const jacobian = this.calculateJacobian(guessX, guessY);

      // Calculer les dérivées partielles
      const determinant = jacobian[0][0] * jacobian[1][1] - jacobian[0][1] * jacobian[1][0];
      if (determinant === 0) {
        console.error("La matrice jacobienne est singulière, inversion impossible.");
        return null;
      }

      const deltaGuessX =
        (jacobian[1][1] * errorX - jacobian[0][1] * errorY) / determinant;
      const deltaGuessY =
        (-jacobian[1][0] * errorX + jacobian[0][0] * errorY) / determinant;

      // Mettre à jour les valeurs de départ
      guessX -= deltaGuessX;
      guessY -= deltaGuessY;
    }

    // Si la convergence n'est pas atteinte après maxIterations itérations
    console.warn("Convergence non atteinte lors de l'inversion de la transformation.");
    return null;
  }

  /**
   * Calcule la matrice jacobienne pour la transformation polynomiale.
   * @param x Coordonnée X en pixels
   * @param y Coordonnée Y en pixels
   * @returns Matrice jacobienne
   */
  private calculateJacobian(x: number, y: number): number[][] {
    const coeffsX = this.transformCoefficients[0];
    const coeffsY = this.transformCoefficients[1];

    switch (this.transformationType) {
      case TransformationType.POLYNOMIAL_1:
        return [
          [coeffsX[1], coeffsX[2]], // ∂x'/∂x, ∂x'/∂y
          [coeffsY[1], coeffsY[2]]  // ∂y'/∂x, ∂y'/∂y
        ];

      case TransformationType.POLYNOMIAL_2: {
        const dx = [coeffsX[1] + 2 * coeffsX[3] * x + coeffsX[4] * y, coeffsX[2] + coeffsX[4] * x + 2 * coeffsX[5] * y];
        const dy = [coeffsY[1] + 2 * coeffsY[3] * x + coeffsY[4] * y, coeffsY[2] + coeffsY[4] * x + 2 * coeffsY[5] * y];
        return [dx, dy];
      }

      case TransformationType.POLYNOMIAL_3: {
        const dx = [
          coeffsX[1] + 2 * coeffsX[3] * x + coeffsX[4] * y + 3 * coeffsX[6] * x * x + 2 * coeffsX[7] * x * y + coeffsX[8] * y * y,
          coeffsX[2] + coeffsX[4] * x + 2 * coeffsX[5] * y + coeffsX[7] * x * x + 2 * coeffsX[8] * x * y + 3 * coeffsX[9] * y * y
        ];
        const dy = [
          coeffsY[1] + 2 * coeffsY[3] * x + coeffsY[4] * y + 3 * coeffsY[6] * x * x + 2 * coeffsY[7] * x * y + coeffsY[8] * y * y,
          coeffsY[2] + coeffsY[4] * x + 2 * coeffsY[5] * y + coeffsY[7] * x * x + 2 * coeffsY[8] * x * y + 3 * coeffsY[9] * y * y
        ];
        return [dx, dy];
      }

      default:
        return [[1, 0], [0, 1]]; // Identité par défaut
    }
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