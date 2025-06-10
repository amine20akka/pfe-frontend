/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElementRef, Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, filter, map, Observable, switchMap } from 'rxjs';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions, Draw, Interaction, Modify, Select, Snap, Translate } from 'ol/interaction';
import { singleClick, pointerMove } from 'ol/events/condition';
import TileLayer from 'ol/layer/Tile';
// import OSM from 'ol/source/OSM';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GcpDialogComponent } from '../components/gcp-dialog/gcp-dialog.component';
import { GcpService } from './gcp.service';
import { XYZ } from 'ol/source';
import { GcpDto } from '../dto/gcp-dto';
import { LayerService } from './layer.service';
import { ImageService } from './image.service';
import BaseLayer from 'ol/layer/Base';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Circle as CircleStyle, Style, Stroke } from 'ol/style';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { ImageFileService } from './image-file.service';
import { GeorefLayer } from '../models/georef-layer.model';
import { GeorefApiService } from './georef-api.service';
import { NotificationService } from './notification.service';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { MockLayer } from '../interfaces/mock-layer';
import Feature from 'ol/Feature';
import Overlay from 'ol/Overlay';
import Point from 'ol/geom/Point';
import { FeatureActionsDialogComponent } from '../components/feature-actions-dialog/feature-actions-dialog.component';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from '../shared/components/confirm-dialog/confirm-dialog-data';
import { MatSnackBar } from '@angular/material/snack-bar';
import Collection from 'ol/Collection';
import { Geometry } from 'ol/geom';
import { LAYER_CONFIG } from '../mock-layers/style-config';
import { GEOSERVER_CONFIG } from '../mock-layers/geoserver-wfs-config';
import { labelize } from '../mock-layers/utils';
import { Type } from 'ol/geom/Geometry';
import { DrawApiService } from './draw-api.service';
import { LayerSchema } from '../interfaces/layer-schema';
import { EntityMode } from '../enums/entity-modes';
import { FeatureUpdateResult } from '../dto/feature-update-result';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map!: OLMap;
  private OSMLayer: TileLayer = new TileLayer();
  private mapSubject = new BehaviorSubject<OLMap | null>(null);
  private isMapSelectionSubject = new BehaviorSubject<boolean>(false);
  private mapCoordinates = new BehaviorSubject<{ x: number, y: number }>({ x: 0, y: 0 });
  private selectInteraction: Select | null = null;
  private hoverInteraction: Select | null = null;
  private modifyInteraction: Modify | null = null;
  private translateInteraction: Translate | null = null;
  private snapInteraction: Snap | null = null;
  private hoverOverlay!: Overlay;
  private sidebarVisibleSubject = new BehaviorSubject<boolean>(false);
  private drawInteraction: Draw | null = null;
  private activeEntityModeSubject = new BehaviorSubject<EntityMode | null>(null);
  activeEntityMode$ = this.activeEntityModeSubject.asObservable();
  private isDrawingSubject = new BehaviorSubject<boolean>(false);
  isDrawing$ = this.isDrawingSubject.asObservable();
  private editLayerSubject = new BehaviorSubject<MockLayer | null>(null);
  editLayer$ = this.editLayerSubject.asObservable();
  private editFeatureSubject = new BehaviorSubject<Feature | null>(null);
  sidebarVisible$ = this.sidebarVisibleSubject.asObservable();
  editFeature$ = this.editFeatureSubject.asObservable();
  private featuresToSnap = new Collection<Feature<Geometry>>;
  map$ = this.mapSubject.asObservable();
  mapCoordinates$ = this.mapCoordinates.asObservable();
  isMapSelection$ = this.isMapSelectionSubject.asObservable();

  constructor(
    private dialog: MatDialog,
    private gcpService: GcpService,
    private layerService: LayerService,
    private imageService: ImageService,
    private imageFileService: ImageFileService,
    private georefApiService: GeorefApiService,
    private drawApiService: DrawApiService,
    private notifService: NotificationService,
    private ngZone: NgZone,
    private snackBar: MatSnackBar,
  ) {
    this.isMapSelection$
      .pipe(
        filter(isSelecting => isSelecting), // Proceed only if selection is active
        switchMap(() => this.layerService.selectGcpFromMap(this.map)) // Wait for map click
      )
      .subscribe((coords) => {
        if (coords) {
          // Reopen the dialog with selected coordinates
          const dialogRef = this.openGcpDialog(coords.x, coords.y);
          this.updateMapSelection(false);

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.gcpService.addGcp(
                this.imageService.getGeorefImage().id,
                this.imageFileService.cursorCoordinates.getValue().x,
                this.imageFileService.cursorCoordinates.getValue().y,
                result.mapX,
                result.mapY
              ).subscribe((savedGcp: GcpDto | null) => {
                if (savedGcp && (coords.x !== result.mapX || coords.y !== result.mapY)) {
                  this.layerService.updateMapGcpPosition(savedGcp.index, result.mapX, result.mapY);
                }
              });
            }
          });
        }
      });
  }

  // createOSMLayer(): TileLayer {
  //   this.OSMLayer = new TileLayer({
  //     source: new OSM()
  //   })
  //   return this.OSMLayer;
  // }

  createSatelliteLayer(): TileLayer {
    this.OSMLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      })
    });
    return this.OSMLayer;
  }

  initMap(target: string): void {
    if (!this.map) {
      this.map = new OLMap({
        target: target,
        interactions: defaultInteractions(),
        layers: [this.createSatelliteLayer()],
        view: new View({
          projection: 'EPSG:3857', // Projection Web Mercator
          center: [-59598.84, 5339845.08],
          zoom: 17
        }),
        controls: defaultControls({ zoom: false, attribution: false, rotate: false })
      });

      this.mapSubject.next(this.map);

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
    this.mapSubject.next(this.map);
  }

  addWfsLayers(): void {
    // Création des styles avancés
    const styles: Record<string, Style> = this.createAdvancedStyles();

    // Création des sources avec configuration centralisée
    const sources: Record<string, VectorSource> = this.createWfsSources();

    // Création des couches avec styles personnalisés
    const layers: Record<string, { layer: VectorLayer, config: unknown }> = this.createStyledLayers(sources, styles);

    // Configuration des événements et ajout aux services
    this.setupLayerEvents(sources, layers);

    // Ajout aux services de gestion
    this.registerLayers(layers);
  }

  private createAdvancedStyles(): Record<string, Style> {
    return {
      cableArtere: new Style({
        stroke: new Stroke({
          color: LAYER_CONFIG.cableArtere.style.stroke.color,
          width: LAYER_CONFIG.cableArtere.style.stroke.width,
          lineDash: LAYER_CONFIG.cableArtere.style.stroke.lineDash
        }),
        // Effet d'ombre pour les câbles
        zIndex: 1
      }),

      cableArtereShadow: new Style({
        stroke: new Stroke({
          color: LAYER_CONFIG.cableArtere.style.shadow.color,
          width: LAYER_CONFIG.cableArtere.style.shadow.width
        }),
        zIndex: 0
      }),

      chambre: new Style({
        image: new CircleStyle({
          radius: LAYER_CONFIG.chambre.style.circle.radius,
          fill: new Fill({
            color: LAYER_CONFIG.chambre.style.circle.fill
          }),
          stroke: new Stroke({
            color: LAYER_CONFIG.chambre.style.circle.stroke,
            width: LAYER_CONFIG.chambre.style.circle.strokeWidth
          })
        }),
        zIndex: 2
      }),

      chambreHalo: new Style({
        image: new CircleStyle({
          radius: LAYER_CONFIG.chambre.style.halo.radius,
          fill: new Fill({
            color: LAYER_CONFIG.chambre.style.halo.fill
          })
        }),
        zIndex: 1
      }),

      batiment: new Style({
        fill: new Fill({
          color: LAYER_CONFIG.batiment.style.fill.color
        }),
        stroke: new Stroke({
          color: LAYER_CONFIG.batiment.style.stroke.color,
          width: LAYER_CONFIG.batiment.style.stroke.width
        })
      })
    };
  }

  private createWfsSources(): Record<string, VectorSource> {
    const createSource = (typename: string) => new VectorSource({
      format: new GeoJSON(),
      url: (extent) => this.buildWfsUrl(typename, extent),
      strategy: bboxStrategy
    });

    return {
      cableArtere: createSource(LAYER_CONFIG.cableArtere.typename),
      chambre: createSource(LAYER_CONFIG.chambre.typename),
      batiment: createSource(LAYER_CONFIG.batiment.typename)
    };
  }

  private createStyledLayers(sources: Record<string, VectorSource>, styles: Record<string, Style>): Record<string, { layer: VectorLayer, config: unknown }> {
    const cableArtereLayer = new VectorLayer({
      source: sources['cableArtere'],
      style: () => {
        // Style dynamique basé sur le niveau de zoom
        const zoom = this.map.getView().getZoom() || 1;

        if (zoom > 15) {
          // Affichage détaillé avec ombre
          return [styles['cableArtereShadow'], styles['cableArtere']];
        } else {
          // Affichage simplifié
          return styles['cableArtere'];
        }
      },
      opacity: 0.9,
      zIndex: 10,
      minZoom: 10, // Optimisation performances
      declutter: true // Évite la superposition des labels
    });

    const chambreLayer = new VectorLayer({
      source: sources['chambre'],
      style: () => {
        const zoom = this.map.getView().getZoom() || 1;

        if (zoom > 14) {
          // Affichage avec halo pour les niveaux de zoom élevés
          return [styles['chambreHalo'], styles['chambre']];
        } else {
          return styles['chambre'];
        }
      },
      opacity: 0.8,
      zIndex: 10,
      minZoom: 12
    });

    const batimentLayer = new VectorLayer({
      source: sources['batiment'],
      style: () => {
        const zoom = this.map.getView().getZoom() || 1;

        return zoom > 13 ?
          [styles['batiment']] : styles['batiment'];
      },
      opacity: 1,
      zIndex: 9,
      minZoom: 11,
      declutter: false // Les bâtiments peuvent se chevaucher naturellement
    });

    return {
      cableArtere: {
        layer: cableArtereLayer,
        config: LAYER_CONFIG.cableArtere
      },
      chambre: {
        layer: chambreLayer,
        config: LAYER_CONFIG.chambre
      },
      batiment: {
        layer: batimentLayer,
        config: LAYER_CONFIG.batiment
      }
    };
  }

  private setupLayerEvents(sources: Record<string, VectorSource>, layers: Record<string, { layer: VectorLayer, config: unknown }>) {
    sources['cableArtere'].on('addfeature', (e) => this.enrichFeature(e.feature!, layers['cableArtere'].config));

    sources['chambre'].on('addfeature', (e) => this.enrichFeature(e.feature!, layers['chambre'].config));

    sources['batiment'].on('addfeature', (e) => this.enrichFeature(e.feature!, layers['batiment'].config));

    // Gestion des erreurs de chargement
    Object.values(sources).forEach((source) => {
      source.on('featuresloaderror', (e) => {
        console.error('Erreur de chargement des features:', e);
        this.notifService.showError('Erreur de chargement des données cartographiques');
      });
    });
  }

  private registerLayers(layers: any) {
    const mockLayers: MockLayer[] = [
      {
        layerId: layers.cableArtere.config.id,
        name: layers.cableArtere.config.name,
        wfsLayer: layers.cableArtere.layer,
        opacity: 0.9
      },
      {
        layerId: layers.chambre.config.id,
        name: layers.chambre.config.name,
        wfsLayer: layers.chambre.layer,
        opacity: 0.8,
      },
      {
        layerId: layers.batiment.config.id,
        name: layers.batiment.config.name,
        wfsLayer: layers.batiment.layer,
        opacity: 0.8
      }
    ];

    mockLayers.forEach(layer => {
      this.layerService.addToMockLayers(layer);
    });
  }

  private buildWfsUrl(typename: string, extent: number[]): string {
    const params = new URLSearchParams({
      ...GEOSERVER_CONFIG.params,
      typename,
      bbox: `${extent.join(',')},EPSG:3857`
    });

    return `${GEOSERVER_CONFIG.baseUrl}?${params.toString()}`;
  }

  private enrichFeature(feature: Feature, config: any): void {
    if (feature) {
      feature.set('layerId', config.id);
      feature.set('layerName', config.name);
    }
  }

  setEditLayer(mockLayer: MockLayer | null): void {
    this.editLayerSubject.next(mockLayer);
  }

  getModifyInteraction(): Modify | null {
    return this.modifyInteraction;
  }

  getSelectInteraction(): Select | null {
    return this.selectInteraction;
  }

  setSelectInteraction(selectInteraction: Select | null): void {
    this.selectInteraction = selectInteraction;
  }

  addInteractionToMap(interaction: Interaction): void {
    if (this.map) {
      this.map.addInteraction(interaction);
    }
  }

  removeInteractionFromMap(interaction: Interaction): void {
    if (this.map) {
      this.map.removeInteraction(interaction);
    }
  }

  initOverlays(hoverPopupElement: ElementRef): void {
    this.hoverOverlay = new Overlay({
      element: hoverPopupElement.nativeElement,
      offset: [0, -10],
      positioning: 'bottom-center',
      stopEvent: false
    });
    this.map.addOverlay(this.hoverOverlay);
  }

  initHoverInteraction(vectorLayers: VectorLayer[], hoverPopupElement: ElementRef, hoverPopupContentElement: ElementRef): void {
    if (this.hoverInteraction) {
      this.map.removeInteraction(this.hoverInteraction);
      this.hoverInteraction = null;
    }

    this.hoverInteraction = new Select({
      condition: pointerMove,
      layers: vectorLayers,
      style: null,
    });

    this.map.addInteraction(this.hoverInteraction);

    this.hoverInteraction.on('select', (e) => {
      const mapElement = this.map.getTargetElement();
      const hoveredFeature = e.selected[0];
      if (hoveredFeature) {
        mapElement.style.cursor = 'pointer';
        this.displayHoverTooltip(hoveredFeature, hoverPopupElement, hoverPopupContentElement);
      } else {
        mapElement.style.cursor = 'default';
        this.hideHoverTooltip(hoverPopupElement);
      }
    });
  }

  deactivateHoverInteraction(): void {
    if (this.hoverInteraction) {
      this.removeInteractionFromMap(this.hoverInteraction);
      this.hoverInteraction = null;
    }
  }

  activateHoverInteraction(hoverPopupElement: ElementRef, hoverPopupContentElement: ElementRef): void {
    if (this.hoverInteraction) {
      this.map.addInteraction(this.hoverInteraction);

      this.hoverInteraction.on('select', (e) => {
        const mapElement = this.map.getTargetElement();
        const hoveredFeature = e.selected[0];
        if (hoveredFeature) {
          mapElement.style.cursor = 'pointer';
          this.displayHoverTooltip(hoveredFeature, hoverPopupElement, hoverPopupContentElement);
        } else {
          mapElement.style.cursor = 'default';
          this.hideHoverTooltip(hoverPopupElement);
        }
      });
    }
  }

  private displayHoverTooltip(feature: Feature, hoverPopupElement: ElementRef, hoverPopupContentElement: ElementRef): void {
    // Récupérer la géométrie et calculer le point central
    const geometry = feature.getGeometry();
    if (!geometry) return;

    let coordinate;
    if (geometry.getType() === 'Point') {
      coordinate = (geometry as Point).getCoordinates();
    } else {
      const extent = geometry.getExtent();
      coordinate = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    }

    const props = feature.getProperties();
    let htmlContent = '<div class="tooltip-content">';
    htmlContent += `<h4 class="layer-name">${props['layerName']}</h4>`;

    // Filtrer pour ne pas afficher la géométrie
    // eslint-disable-next-line prefer-const
    for (let [key, value] of Object.entries(props)) {
      if (key !== 'geometry' && key !== 'layerId' && key !== 'layerName' && key !== 'isNew') {
        const labelizedKey = labelize(key);
        if (typeof value === 'string' && !isNaN(Date.parse(value))) {
          const formatted = new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'UTC'
          }).format(new Date(value));
          value = formatted;
        }
        htmlContent += `<p><strong>${labelizedKey} :</strong> ${value}</p>`;
      }
    }
    htmlContent += '</div>';

    // Mettre à jour le contenu du popup de survol
    hoverPopupContentElement.nativeElement.innerHTML = htmlContent;

    // Positionner et afficher le popup
    this.hoverOverlay.setPosition(coordinate);
    hoverPopupElement.nativeElement.style.display = 'block';
  }

  hideHoverTooltip(hoverPopupElement: ElementRef): void {
    if (hoverPopupElement) {
      hoverPopupElement.nativeElement.style.display = 'none';
      this.hoverOverlay.setPosition(undefined);
    }
  }

  private initializeFeaturesToSnap(): void {
    this.featuresToSnap.clear();
    
    const mockLayers = this.layerService.getMockLayers();
    mockLayers.forEach(mockLayer => {
      const vectorLayer = mockLayer.wfsLayer as VectorLayer;
      const source = vectorLayer.getSource();
      
      if (source) {
        const features = source.getFeatures();
        features.forEach(feature => {
          this.featuresToSnap.push(feature);
        });
      }
    });
    
    console.log(`FeaturesToSnap initialisé avec ${this.featuresToSnap.getLength()} features`);
  }

  activateSnapInteraction(): void {
    this.snapInteraction = new Snap({ features: this.featuresToSnap });
    this.addInteractionToMap(this.snapInteraction);
  }

  deactivateSnapInteraction(): void {
    this.removeInteractionFromMap(this.snapInteraction!);
  }

  enableSelectInteraction(): void {
    if (this.selectInteraction) {
      this.map.removeInteraction(this.selectInteraction);
      this.selectInteraction = null;
    }

    this.selectInteraction = new Select({
      layers: this.editLayerSubject.getValue() ? [this.editLayerSubject.getValue()!.wfsLayer] : [],
      condition: singleClick
    });

    this.map.addInteraction(this.selectInteraction);

    this.snackBar.open('Sélectionner une entité sur la carte', 'Fermer', {
      duration: Infinity,
    });

    this.selectInteraction.on('select', (e) => {
      const selectedFeature = e.selected[0];
      if (selectedFeature) {
        this.dismissSelectSnackbar();
        this.hideHoverTooltip(new ElementRef(this.hoverOverlay.getElement()!));

        this.ngZone.run(() => {
          this.openFeatureActionsDialog(selectedFeature, this.editLayerSubject.getValue()!.layerId);
        });
      }
    });
  }

  dismissSelectSnackbar(): void {
    this.snackBar.dismiss();
  }

  enableDrawForActiveLayer(): void {
    this.deactivateDrawInteractions();

    const currentEditLayer = this.editLayerSubject.getValue();
    this.getGeometryTypeFromLayer(currentEditLayer!.layerId).subscribe({
      next: (geometryType: string) => {
        if (!geometryType) {
          this.notifService.showError('Type de géométrie non supporté pour cette couche');
          return;
        }

        const source = currentEditLayer!.wfsLayer.getSource() as VectorSource;

        this.drawInteraction = new Draw({
          source: source,
          type: geometryType as Type,
          style: this.getDrawStyle()
        });

        this.map.addInteraction(this.drawInteraction);
        this.isDrawingSubject.next(true);
        
        this.initializeFeaturesToSnap();
        this.activateSnapInteraction();

        // Afficher le snackbar d'instruction
        this.snackBar.open(`Dessinez ${this.getGeometryLabel(geometryType)} sur la carte`, 'Annuler', {
          duration: Infinity,
        }).onAction().subscribe(() => {
          this.cancelDrawing();
        });

        // Écouter la fin du dessin
        this.drawInteraction.on('drawend', (event) => {
          this.onDrawEnd(event.feature, currentEditLayer!);
        });
      }
    });
  }

  cancelDrawing(): void {
    this.deactivateDrawInteractions();
    this.snackBar.dismiss();
  }

  private getGeometryTypeFromLayer(layerId: string): Observable<string> {
    return this.drawApiService.getLayerSchema(layerId).pipe(
      map((schema: LayerSchema) => schema.geometryType));
  }

  private getDrawStyle(): Style {
    return new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)'
      }),
      stroke: new Stroke({
        color: '#ff0000',
        width: 2
      }),
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({
          color: '#ff0000'
        })
      })
    });
  }

  private getGeometryLabel(geometryType: string): string {
    switch (geometryType) {
      case 'Point':
        return 'un point';
      case 'LineString':
        return 'une ligne';
      case 'Polygon':
        return 'un polygone';
      default:
        return 'une géométrie';
    }
  }

  private onDrawEnd(feature: Feature, currentMockLayer: MockLayer): void {
    this.isDrawingSubject.next(false);
    this.ngZone.run(() => {
      this.deactivateSnapInteraction();
      this.removeInteractionFromMap(this.drawInteraction!);
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
      height: '270px',
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
    const mapElement = this.map.getTargetElement();
    mapElement.style.cursor = 'default';

    this.openSidebarEditor(feature);

    this.disableSelectInteraction();
    this.removeInteractionFromMap(this.hoverInteraction!);
    this.deactivateDrawInteractions();

    const featureSource = this.getFeatureSource(feature.getProperties()['layerId']);

    this.modifyInteraction = new Modify({
      source: featureSource!,
      features: new Collection([feature])
    });

    this.translateInteraction = new Translate({
      features: new Collection([feature])
    });

    this.map.addInteraction(this.translateInteraction);
    this.map.addInteraction(this.modifyInteraction);
    this.initializeFeaturesToSnap();
    this.activateSnapInteraction();
  }

  private getFeatureSource(layerId: string): VectorSource {
    const mockLayer = this.layerService.getMockLayers().find(layer => layer.layerId === layerId);
    const vectorLayer = mockLayer!.wfsLayer as VectorLayer;
    return vectorLayer.getSource() as VectorSource;
  }

  deactivateDrawInteractions(): void {
    this.map.getInteractions().getArray()
      .filter(interaction => interaction instanceof Modify || interaction instanceof Draw || interaction instanceof Translate || interaction instanceof Snap)
      .forEach(interaction => this.removeInteractionFromMap(interaction));
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

  disableSelectInteraction(): void {
    if (this.selectInteraction) {
      this.map.removeInteraction(this.selectInteraction);
      this.selectInteraction = null;
    }
  }

  activateDrawSnackbar(): void {
    this.snackBar.open('Choisissez un mode dans le panneau', 'Fermer', {
      duration: Infinity,
    });
  }

  dismissDrawSnackbar(): void {
    this.snackBar.dismiss();
  }

  restoreFeatureGeometry(featureId: string | number | undefined, originalGeometry: Geometry): void {
    if (!featureId || !originalGeometry) {
      console.error('Feature ID ou géométrie manquante');
      return;
    }

    const mockLayer = this.layerService.getMockLayers().find(layer =>
      layer.layerId === this.editLayerSubject.getValue()?.layerId
    );

    if (mockLayer) {
      const vectorLayer = mockLayer.wfsLayer as VectorLayer;
      const source = vectorLayer.getSource();

      if (source) {
        const feature = source.getFeatureById(featureId);

        if (feature) {
          const clonedGeometry = originalGeometry.clone();

          feature.setGeometry(clonedGeometry);

          feature.changed();
        } else {
          console.error('Feature non trouvé avec l\'ID:', featureId);
        }
      }
    } else {
      console.error('Couche non trouvée');
    }
  }

  removeFeatureFromMap(feature: Feature): void {
    const mockLayer = this.layerService.getMockLayers().find(layer => layer.layerId === this.editLayerSubject.getValue()?.layerId);
    if (mockLayer) {
      const vectorLayer = mockLayer.wfsLayer as VectorLayer;
      vectorLayer.getSource()!.removeFeature(feature);
    }
  }

  getMap(): OLMap | null {
    return this.mapSubject.getValue();
  }

  addLayerToMap(newlayer: BaseLayer): void {
    this.layerService.addLayerToMap(this.map, newlayer);
  }

  syncMapLayers(): void {
    this.layerService.syncMapLayers(this.map, this.OSMLayer);
  }

  updateMapSelection(status: boolean): void {
    this.isMapSelectionSubject.next(status);
  }

  removeLayerFromMap(removedLayer: BaseLayer): void {
    this.map.removeLayer(removedLayer);
  }

  removeAllGcpLayersFromMap(): void {
    this.layerService.removeAllGcpLayersFromMap(this.map);
  }

  deleteGeorefLayerFromMap(georefLayer: GeorefLayer): void {
    this.georefApiService.deleteGeorefLayerById(georefLayer.id).subscribe({
      next: () => {
        this.layerService.deleteGeorefLayerFromMap(georefLayer);
        this.removeLayerFromMap(georefLayer.layer!);
      }
    })
  }

  removeGeorefLayerAndImageFromMap(georefLayer: GeorefLayer): void {
    this.georefApiService.deleteGeorefLayerAndImageById(georefLayer.id).subscribe({
      next: () => {
        this.layerService.deleteGeorefLayerFromMap(georefLayer);
        this.removeLayerFromMap(georefLayer.layer!);
      },
      error: (err) => {
        if (err.status === 404) {
          this.notifService.showError("Couche géoréférencée introuvable !");
        }
      }
    })
  }

  openGcpDialog(x: number, y: number): MatDialogRef<GcpDialogComponent> {
    return this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true,
      data: { x, y }
    });
  }

  toggleLayerVisibility(layer: BaseLayer): void {
    layer.setVisible(!layer.getVisible());
  }

}
