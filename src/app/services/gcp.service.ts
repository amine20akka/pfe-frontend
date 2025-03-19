import { Injectable } from '@angular/core';
import { GCP } from '../models/gcp';
import { BehaviorSubject } from 'rxjs';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import { colors } from '../shared/colors';
import { SRID, TransformationType } from '../models/georef-settings';
import { GeorefSettingsService } from './georef-settings.service';
import { ResidualService } from './residual.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class GcpService {

  private gcps: GCP[] = [];
  private gcpsSubject = new BehaviorSubject<GCP[]>(this.gcps);
  private totalRMSESubject = new BehaviorSubject<number>(0);
  private isFloatingSubject = new BehaviorSubject<boolean>(false);
  private isNearOriginalPositionSubject = new BehaviorSubject<boolean>(false);
  private transformationType!: TransformationType;
  private srid!: SRID;

  cursorCoordinates = new BehaviorSubject<{ x: number; y: number }>({ x: 0, y: 0 });
  gcps$ = this.gcpsSubject.asObservable();
  totalRMSE$ = this.totalRMSESubject.asObservable();
  gcpStyles: Style[] = [];
  isAddingGCP = false; // Gère l'ajout de points de contrôle
  isFloating$ = this.isFloatingSubject.asObservable();
  isNearOriginalPosition$ = this.isNearOriginalPositionSubject.asObservable();
  loadingGCPs = false;

  constructor(
    private georefSettingsService: GeorefSettingsService,
    private residualService: ResidualService,
    private notifService: NotificationService,
  ) {
    this.initGcpStyles();
    this.georefSettingsService.settings$.subscribe((settings) => {
      this.transformationType = settings.transformationType;
      this.srid = settings.srid;
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
    this.gcpsSubject.next(this.gcps);
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

    // Recalculer les résidus
    this.updateResiduals();

    setTimeout(() => {
      this.gcpsSubject.next(this.gcps)
    }, 300);
  }

  updateGcp(updatedGcp: GCP): void {
    const index = this.gcps.findIndex(gcp => gcp.index === updatedGcp.index);
    if (index !== -1) {
      this.gcps[index] = updatedGcp;

      // Recalculer les résidus
      this.updateResiduals();

      this.gcpsSubject.next(this.gcps);
    }
  }

  /**
   * Vérifie s'il y a suffisamment de GCPs pour le type de transformation choisi
   */
  hasEnoughGCPs(): boolean {
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

  updateResiduals(): void {
    if (this.hasEnoughGCPs()) {
      this.residualService.computeResiduals(this.gcps, this.transformationType, this.srid)
        .subscribe((response) => {
          if (response.residuals.length === this.gcps.length) {
            for (let i = 0; i < this.gcps.length; i++) {
              this.gcps[i].residual = parseFloat(response.residuals[i].toFixed(4));
            }
          }

          const totalRMSE = response.rmse;
          this.totalRMSESubject.next(totalRMSE);

          this.gcpsSubject.next(this.gcps);
        });
    } else {
      this.gcps.forEach(gcp => gcp.residual = undefined);
      this.gcpsSubject.next(this.gcps);
      this.totalRMSESubject.next(0);
    }
  }

  /**
   * Retourne le RMSE global pour tous les points
   */
  getTotalRMSE(): number {
    return parseFloat(this.totalRMSESubject.getValue().toFixed(3));
  }

  private initGcpStyles(): void {
    for (let i = 0; i < 20; i++) {
      this.gcpStyles.push(new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: colors[i % colors.length].fill }),
        })
      }));
    }
  }

  updateFloatingStatus(status: boolean): void {
    this.isFloatingSubject.next(status);
  }

  updateNearOriginalPositionStatus(status: boolean): void {
    this.isNearOriginalPositionSubject.next(status);
  }

  async saveGCPs(): Promise<void> {
    if (this.gcps.length === 0) {
      this.notifService.showError("Aucun point n'est encore défini");
      return;
    }

    // Transformer les données au format simplifié avant de les enregistrer
    const simplifiedGcps = this.gcps.map(gcp => ({
      sourceX: gcp.sourceX,
      sourceY: gcp.sourceY,
      mapX: gcp.mapX,
      mapY: gcp.mapY
    }));

    const gcpData = JSON.stringify(simplifiedGcps, null, 2);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: 'gcps.json',
        types: [
          {
            description: 'Fichier JSON',
            accept: { 'application/json': ['.json'] }
          }
        ]
      });

      const writableStream = await fileHandle.createWritable();
      await writableStream.write(gcpData);
      await writableStream.close();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement des points: ', error);
    }
  }

  async loadGCPs(event: Event): Promise<GCP[]> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();

      return new Promise<GCP[]>((resolve, reject) => {
        reader.onload = () => {
          try {
            this.updateLoadingGCPs(true);

            // Charger les données simplifiées
            const simplifiedGcps = JSON.parse(reader.result as string);

            // Transformer en objets GCP complets en utilisant la méthode createGCP
            const gcps: GCP[] = [];

            // Sauvegarde temporaire de la longueur actuelle pour pouvoir réinitialiser les index
            const currentLength = this.gcps.length;

            // Transformer chaque point simplifié en utilisant createGCP
            simplifiedGcps.forEach((simplifiedGcp: {sourceX: number, sourceY: number, mapX: number, mapY: number}) => {
              // Nous devons modifier temporairement this.gcps.length pour que les index soient corrects
              this.gcps.length = gcps.length + currentLength;
              const newGCP = this.createGCP(simplifiedGcp.sourceX, simplifiedGcp.sourceY, simplifiedGcp.mapX, simplifiedGcp.mapY);
              gcps.push(newGCP);
            });

            // Restaurer la longueur d'origine
            this.gcps.length = currentLength;

            console.log('Les GCPs chargés : ', gcps);
            resolve(gcps);
          } catch (error) {
            console.error('Erreur de parsing JSON', error);
            reject([]);
          }
        };

        reader.onerror = () => {
          console.error('Erreur de lecture du fichier');
          reject([]);
        };

        reader.readAsText(file);
      });
    }
    return [];
  }

  updateLoadingGCPs(status: boolean): void {
    this.loadingGCPs = status;
  }

  addGCPs(gcps: GCP[]): void {
    const updatedGcps = [...this.gcps, ...gcps];
    this.gcps = updatedGcps;
    this.gcpsSubject.next(this.gcps);
    this.updateResiduals();
  }
}