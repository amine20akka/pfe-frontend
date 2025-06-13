/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElementRef, Injectable } from '@angular/core';
import { BehaviorSubject, filter, switchMap } from 'rxjs';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions, Draw, Interaction, Modify, Select, Snap, Translate } from 'ol/interaction';
import { pointerMove } from 'ol/events/condition';
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
import { LAYER_CONFIG } from '../mock-layers/style-config';
import { GEOSERVER_CONFIG } from '../mock-layers/geoserver-wfs-config';
import { labelize } from '../mock-layers/utils';
import { Extent } from 'ol/extent';
import { EventsKey } from 'ol/events';
import { unByKey } from 'ol/Observable';
import { MultiPolygon, Polygon } from 'ol/geom';
@Injectable({
  providedIn: 'root'
})
export class MapService {

  private map!: OLMap;
  private OSMLayer: TileLayer = new TileLayer();
  private isMapSelectionSubject = new BehaviorSubject<boolean>(false);
  private mapCoordinates = new BehaviorSubject<{ x: number, y: number }>({ x: 0, y: 0 });
  private selectInteraction: Select | null = null;
  private translateInteraction: Translate | null = null;
  private pointerMoveListener: EventsKey | null = null;
  private grabbingListener: EventsKey | null = null;
  private grabListener: EventsKey | null = null;
  private hoverInteraction: Select | null = null;
  private snapInteraction: Snap | null = null;
  private hoverOverlay!: Overlay;
  private drawInteraction: Draw | null = null;
  mapCoordinates$ = this.mapCoordinates.asObservable();
  isMapSelection$ = this.isMapSelectionSubject.asObservable();

  constructor(
    private dialog: MatDialog,
    private gcpService: GcpService,
    private layerService: LayerService,
    private imageService: ImageService,
    private imageFileService: ImageFileService,
    private georefApiService: GeorefApiService,
    private notifService: NotificationService,
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

  setDefaultMapCursor(): void {
    const mapElement = this.map.getTargetElement();
    mapElement.style.cursor = 'default';
  }

  setDrawCursor(): void {
    const mapElement = this.map.getTargetElement();
    mapElement.style.cursor = 'crosshair';
  }

  setupEditCursorListeners(feature: Feature): void {
    this.pointerMoveListener = this.map.on('pointermove', (e) => {
      const pixel = this.map.getEventPixel(e.originalEvent);
      const featuresAtPixel = this.map.getFeaturesAtPixel(pixel);
  
      if (featuresAtPixel.length > 0) {
        // Vérifier si on survole la feature principale
        const isMainFeature = featuresAtPixel.some(f => f.getId() === feature.getId());
        
        // Vérifier si on survole un vertex (les vertex ont généralement un style différent)
        const isVertex = featuresAtPixel.some(f => 
          f.getGeometry()?.getType() === 'Point' && f !== feature
        );
  
        if (isVertex) {
          this.setMapCursor('pointer');
        } else if (isMainFeature) {
          this.setMapCursor('grab');
        } else {
          this.setMapCursor('default');
        }
      } else {
        this.setMapCursor('default');
      }
    });

    if (feature.getGeometry() instanceof Polygon || feature.getGeometry() instanceof MultiPolygon) {
      this.grabListener = this.translateInteraction!.on('translatestart', () => this.setMapCursor('grabbing'));
      this.grabbingListener = this.translateInteraction!.on('translating', () => this.setMapCursor('grabbing'));
    }
  }

  cleanupModifyCursorListeners(): void {
    if (this.pointerMoveListener) {
      unByKey(this.pointerMoveListener);
      this.pointerMoveListener = null;
    }

    if (this.grabbingListener) {
      unByKey(this.grabbingListener);
      this.grabbingListener = null;
    }

    if (this.grabListener) {
      unByKey(this.grabListener);
      this.grabListener = null;
    }

    this.setMapCursor('default');
  }

  getSelectInteraction(): Select | null {
    return this.selectInteraction;
  }

  setSelectInteraction(selectInteraction: Select | null): void {
    this.selectInteraction = selectInteraction;
  }

  setTranslateInteraction(translateInteraction: Translate | null): void {
    this.translateInteraction = translateInteraction;
  }

  getDrawInteraction(): Draw | null {
    return this.drawInteraction;
  }

  setDrawInteraction(drawInteraction: Draw | null): void {
    this.drawInteraction = drawInteraction;
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

  initHoverInteraction(vectorLayer: VectorLayer, hoverPopupElement: ElementRef, hoverPopupContentElement: ElementRef): void {
    if (this.hoverInteraction) {
      this.map.removeInteraction(this.hoverInteraction);
      this.hoverInteraction = null;
    }

    this.hoverInteraction = new Select({
      condition: pointerMove,
      layers: [vectorLayer],
      style: null,
    });

    this.map.addInteraction(this.hoverInteraction);

    this.hoverInteraction.on('select', (e) => {
      const hoveredFeature = e.selected[0];
      if (hoveredFeature) {
        this.setMapCursor('pointer');
        this.displayHoverTooltip(hoveredFeature, hoverPopupElement, hoverPopupContentElement);
      } else {
        this.setMapCursor('default');
        this.hideHoverTooltip();
      }
    });
  }

  getHoverInteracion(): Select | null {
    return this.hoverInteraction;
  }

  deactivateHoverInteraction(): void {
    if (this.hoverInteraction) {
      this.removeInteractionFromMap(this.hoverInteraction);
      this.hoverInteraction = null;
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

  hideHoverTooltip(): void {
    const hoverPopupElement: ElementRef = new ElementRef(this.hoverOverlay.getElement()!);
    if (hoverPopupElement) {
      hoverPopupElement.nativeElement.style.display = 'none';
      this.hoverOverlay.setPosition(undefined);
    }
  }

  activateSnapInteraction(): void {
    this.snapInteraction = new Snap({ features: this.layerService.getFeaturesToSnap() });
    this.addInteractionToMap(this.snapInteraction);
  }

  deactivateSnapInteraction(): void {
    this.removeInteractionFromMap(this.snapInteraction!);
  }

  deactivateDrawInteractions(): void {
    this.map.getInteractions().getArray()
      .filter(interaction => interaction instanceof Modify || interaction instanceof Draw || interaction instanceof Translate || interaction instanceof Snap)
      .forEach(interaction => this.removeInteractionFromMap(interaction));
  }

  disableSelectInteraction(): void {
    if (this.selectInteraction) {
      this.map.removeInteraction(this.selectInteraction);
      this.selectInteraction = null;
    }
  }

  setMapCursor(cursorType: string): void {
    if (this.map) {
      this.map.getViewport().style.cursor = cursorType;
    }
  }

  zoomToExtent(extent: Extent): void {
    this.map!.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50] });
  }

  mapExists(): boolean {
    return this.map !== null;
  }

  updateSize(): void {
    this.map.updateSize();
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
}
