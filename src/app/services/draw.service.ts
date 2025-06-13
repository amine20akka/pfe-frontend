import { Injectable, NgZone } from '@angular/core';
import { PanelPosition } from '../interfaces/panel-position';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { MockLayer } from '../interfaces/mock-layer';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogData } from '../shared/components/confirm-dialog/confirm-dialog-data';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { FeatureUpdateResult } from '../dto/feature-update-result';
import { DrawApiService } from './draw-api.service';
import { LayerService } from './layer.service';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import { Geometry, LineString, MultiLineString, Point } from 'ol/geom';
import { EntityMode } from '../enums/entity-modes';
import { FeatureActionsDialogComponent } from '../components/feature-actions-dialog/feature-actions-dialog.component';
import { MapService } from './map.service';
import { Draw, Modify, Select, Translate } from 'ol/interaction';
import { singleClick } from 'ol/events/condition';
import { NotificationService } from './notification.service';
import { Type } from 'ol/geom/Geometry';
import { LayerSchema } from '../interfaces/layer-schema';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import Collection from 'ol/Collection';

type AnchorPosition = 'top-left' | 'top-right' | 'middle';

@Injectable({
  providedIn: 'root'
})
export class DrawService {

  panelPosition!: PanelPosition;
  currentAnchor: AnchorPosition = 'middle';

  private editLayerSubject = new BehaviorSubject<MockLayer | null>(null);
  editLayer$ = this.editLayerSubject.asObservable();
  private activeEntityModeSubject = new BehaviorSubject<EntityMode | null>(null);
  activeEntityMode$ = this.activeEntityModeSubject.asObservable();
  private isDrawingSubject = new BehaviorSubject<boolean>(false);
  isDrawing$ = this.isDrawingSubject.asObservable();
  private sidebarVisibleSubject = new BehaviorSubject<boolean>(false);
  sidebarVisible$ = this.sidebarVisibleSubject.asObservable();
  private editFeatureSubject = new BehaviorSubject<Feature | null>(null);
  editFeature$ = this.editFeatureSubject.asObservable();

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private drawApiService: DrawApiService,
    private mapService: MapService,
    private layerService: LayerService,
    private ngZone: NgZone,
    private notifService: NotificationService,
  ) {
    const savedAnchor = localStorage.getItem('drawingToolsPanelAnchor');

    if (savedAnchor && ['top-left', 'top-right', 'middle'].includes(savedAnchor)) {
      this.currentAnchor = savedAnchor as AnchorPosition;
      this.updatePositionFromAnchor();
    } else {
      this.anchorToCorner('middle');
    }
  }

  public getCurrentAnchor(): AnchorPosition {
    return this.currentAnchor;
  }

  public getPanelPosition(): PanelPosition {
    return this.panelPosition;
  }

  onDragEnded(event: CdkDragEnd) {
    const windowWidth = window.innerWidth;
    const panelElement = event.source.element.nativeElement;
    const panelWidth = panelElement.offsetWidth;
    const dragPosition = event.source.getFreeDragPosition();
    const x = dragPosition.x;

    let absoluteX = 0;

    // Calculer la position absolue selon l'ancrage actuel
    switch (this.currentAnchor) {
      case 'top-left':
        absoluteX = x + (this.panelPosition.left || 0);
        break;
      case 'top-right':
        absoluteX = windowWidth - (this.panelPosition.right || 0) - panelWidth + x;
        break;
      case 'middle': {
        const centerPosition = windowWidth / 2 - panelWidth / 2;
        absoluteX = centerPosition + x;
        break;
      }
    }

    // Calculer les distances aux trois positions possibles
    const distanceToLeft = absoluteX;
    const distanceToRight = windowWidth - absoluteX - panelWidth;
    const centerOfPanel = absoluteX + panelWidth / 2;
    const distanceToMiddle = Math.abs(centerOfPanel - windowWidth / 2);

    const distances = [
      { corner: 'top-left', distance: distanceToLeft },
      { corner: 'top-right', distance: distanceToRight },
      { corner: 'middle', distance: distanceToMiddle }
    ];

    // Trier par distance et prendre le plus proche
    const closestCorner = distances.sort((a, b) => a.distance - b.distance)[0].corner as AnchorPosition;

    // Ancrer au coin le plus proche
    this.anchorToCorner(closestCorner);

    // Réinitialiser la position du drag pour éviter l'accumulation
    event.source.reset();
  }

  private anchorToCorner(corner: AnchorPosition) {
    this.currentAnchor = corner;
    this.updatePositionFromAnchor();
    this.savePosition();
  }

  private updatePositionFromAnchor() {
    const safeMargin = 10;

    switch (this.currentAnchor) {
      case 'top-left':
        this.panelPosition = {
          top: safeMargin,
          left: 70,
          right: undefined,
          bottom: undefined
        };
        break;
      case 'top-right':
        this.panelPosition = {
          top: safeMargin,
          left: undefined,
          right: safeMargin,
          bottom: undefined
        };
        break;
      case 'middle':
        this.panelPosition = {
          top: safeMargin,
          left: undefined,
          right: undefined,
          bottom: undefined
        };
        break;
    }
  }

  private savePosition() {
    localStorage.setItem('drawingToolsPanelAnchor', this.currentAnchor);
  }

  activateDrawSnackbar(): void {
    this.snackBar.open('Choisissez un mode dans le panneau', 'Fermer', {
      duration: Infinity,
    });
  }

  dismissDrawSnackbar(): void {
    this.snackBar.dismiss();
  }

  enableSelectInteraction(): void {
    this.mapService.disableSelectInteraction();

    const selectInteraction: Select = new Select({
      layers: this.editLayerSubject.getValue() ? [this.editLayerSubject.getValue()!.wfsLayer] : [],
      condition: singleClick
    });

    this.mapService.setSelectInteraction(selectInteraction);
    this.mapService.addInteractionToMap(selectInteraction);

    this.snackBar.open('Sélectionner une entité sur la carte', 'Fermer', {
      duration: Infinity,
    });

    this.mapService.getSelectInteraction()!.on('select', (e) => {
      const selectedFeature = e.selected[0];
      if (selectedFeature) {
        this.dismissSelectSnackbar();
        this.mapService.hideHoverTooltip();

        this.ngZone.run(() => {
          this.openFeatureActionsDialog(selectedFeature, this.editLayerSubject.getValue()!.layerId);
        });
      }
    });
  }

  dismissSelectSnackbar(): void {
    this.snackBar.dismiss();
  }

  setSelectedFeatureStyle(feature: Feature<Geometry>): void {
    const geometry = feature.getGeometry();
    if (geometry instanceof Point) {
      feature.setStyle(new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: [0, 153, 255, 1] }),
          stroke: new Stroke({ color: [255, 255, 255, 1], width: 1.5 }),
        }),
        zIndex: Infinity,
      }));
    } else if (geometry instanceof LineString || geometry instanceof MultiLineString) {
      feature.setStyle([
        new Style({
          stroke: new Stroke({
            color: [255, 255, 255, 1],
            width: 5,
          }),
        }),
        new Style({
          stroke: new Stroke({
            color: [0, 153, 255, 1],
            width: 3,
          }),
        }),
      ]);
    } else {
      feature.setStyle([
        new Style({
          fill: new Fill({
            color: [255, 255, 255, 0.3],
          }),
        }),
        new Style({
          stroke: new Stroke({
            color: [255, 255, 255, 1],
            width: 5,
          }),
        }),
        new Style({
          stroke: new Stroke({
            color: [0, 153, 255, 1],
            width: 3,
          }),
          zIndex: Infinity,
        }),
      ]);
    }
  }

  restoreDefaultStyle(feature: Feature, defaultStyle: Style): void {
    feature.setStyle(defaultStyle);
  }

  setEditLayer(mockLayer: MockLayer | null): void {
    this.editLayerSubject.next(mockLayer);
  }

  enableDrawForActiveLayer(): void {
    this.mapService.deactivateDrawInteractions();
    this.mapService.deactivateHoverInteraction();

    const currentEditLayer = this.editLayerSubject.getValue();
    this.getGeometryTypeFromLayer(currentEditLayer!.layerId).subscribe({
      next: (geometryType: string) => {
        if (!geometryType) {
          this.notifService.showError('Type de géométrie non supporté pour cette couche');
          return;
        }

        const source = currentEditLayer!.wfsLayer.getSource() as VectorSource;

        const drawInteraction: Draw = new Draw({
          source: source,
          type: geometryType as Type,
          style: this.getDrawStyle()
        });

        this.mapService.setDrawInteraction(drawInteraction);
        this.mapService.addInteractionToMap(drawInteraction);
        this.mapService.setDrawCursor();
        this.updateDrawingStatus(true);

        this.layerService.initializeFeaturesToSnap();
        this.mapService.activateSnapInteraction();

        // Afficher le snackbar d'instruction
        this.snackBar.open(`Dessinez ${this.getGeometryLabel(geometryType)} sur la carte`, 'Fermer', {
          duration: Infinity,
        });

        // Écouter la fin du dessin
        this.mapService.getDrawInteraction()!.on('drawend', (event) => {
          this.onDrawEnd(event.feature, currentEditLayer!);
        });
      }
    });
  }

  private getGeometryTypeFromLayer(layerId: string): Observable<string> {
    return this.drawApiService.getLayerSchema(layerId).pipe(
      map((schema: LayerSchema) => schema.geometryType));
  }

  private getDrawStyle(): Style {
    return new Style({
      fill: new Fill({
        color: 'rgba(59, 130, 246, 0.15)'
      }),
      stroke: new Stroke({
        color: '#3B82F6',
        width: 3,
        lineDash: [0],
        lineCap: 'round',
        lineJoin: 'round'
      }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({
          color: '#FFFFFF'
        }),
        stroke: new Stroke({
          color: '#3B82F6',
          width: 3
        }),
        displacement: [0, 0]
      })
    });
  }

  private getGeometryLabel(geometryType: string): string {
    switch (geometryType) {
      case 'Point':
        return 'un point';
      case 'LineString':
      case 'MultiLineString':
        return 'une ligne';
      case 'Polygon':
      case 'MultiPolygon':
        return 'un polygone';
      default:
        return 'une géométrie';
    }
  }

  private onDrawEnd(feature: Feature, currentMockLayer: MockLayer): void {
    this.updateDrawingStatus(false);
    this.mapService.setDefaultMapCursor();
    this.ngZone.run(() => {
      this.mapService.deactivateSnapInteraction();
      this.mapService.removeInteractionFromMap(this.mapService.getDrawInteraction()!);
      this.snackBar.dismiss();

      const preparedFeature: Feature = this.prepareFeatureForEditing(feature, currentMockLayer);

      this.openSidebarEditor(preparedFeature);
    });
  }

  private prepareFeatureForEditing(feature: Feature, mockLayer: MockLayer): Feature {
    feature.set('layerId', mockLayer.layerId);
    feature.set('layerName', mockLayer.name);
    feature.set('isNew', true);
    return feature;
  }

  private openFeatureActionsDialog(feature: Feature, layerId: string): void {
    const dialogRef = this.dialog.open(FeatureActionsDialogComponent, {
      width: '320px',
      height: 'auto',
      data: { feature },
      panelClass: 'feature-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'edit') {
        this.activateEditMode(feature);
      } else if (result === 'delete') {
        this.confirmDelete(feature.getId()!, layerId);
      } else {
        this.enableSelectInteraction();
      }
    });
  }

  private activateEditMode(feature: Feature): void {
    this.mapService.setDefaultMapCursor();
    this.openSidebarEditor(feature);

    this.mapService.disableSelectInteraction();
    this.mapService.removeInteractionFromMap(this.mapService.getHoverInteracion()!);
    this.mapService.deactivateDrawInteractions();

    const featureSource = this.layerService.getFeatureSource(feature.getProperties()['layerId']);

    const modifyInteraction: Modify = new Modify({
      source: featureSource!,
      features: new Collection([feature]),
      style: this.getDrawStyle()
    });
    
    const translateInteraction: Translate = new Translate({
      features: new Collection([feature])
    });
    this.mapService.setTranslateInteraction(translateInteraction);

    this.mapService.addInteractionToMap(translateInteraction);
    this.mapService.addInteractionToMap(modifyInteraction);

    this.mapService.setupEditCursorListeners(feature);

    this.layerService.initializeFeaturesToSnap();
    this.mapService.activateSnapInteraction();
  }

  private openSidebarEditor(feature: Feature): void {
    this.editFeatureSubject.next(feature);
    this.sidebarVisibleSubject.next(true);
  }

  finishNewFeatureEdit(feature: Feature): void {
    const currentLayerSource: VectorSource<Feature<Geometry>> | null | undefined = this.editLayerSubject.getValue()?.wfsLayer.getSource();
    currentLayerSource!.removeFeature(feature);
    this.editFeatureSubject.next(null);
    this.sidebarVisibleSubject.next(false);
    this.enableDrawForActiveLayer();
  }

  finishEditMode(): void {
    this.mapService.cleanupModifyCursorListeners();
    this.editFeatureSubject.next(null);
    this.sidebarVisibleSubject.next(false);
    this.enableSelectInteraction();
  }

  updateDrawingStatus(isDrawing: boolean): void {
    this.isDrawingSubject.next(isDrawing);
  }

  updateActiveEntityMode(newMode: EntityMode | null): void {
    this.activeEntityModeSubject.next(newMode);
  }

  private confirmDelete(featureId: string | number, layerId: string): void {
    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous sûr de supprimer cette entité ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      icon: 'delete'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.drawApiService.deleteFeature(featureId, layerId).subscribe({
          next: (result: FeatureUpdateResult) => {
            if (result.success) {
              this.layerService.refreshLayerSourceById(layerId);
              this.snackBar.open('Entité supprimée avec succès', 'Fermer', { duration: 3000 });
            } else {
              this.snackBar.open("Erreur lors de la suppression de l'entité", 'Fermer', { duration: 3000 });
            }
          }
        });
      }
    });
  }
}