import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { GcpService } from '../../services/gcp.service';
import { CommonModule } from '@angular/common';
import { GcpDialogComponent } from '../gcp-dialog/gcp-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-image',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './image.component.html',
  styleUrl: './image.component.scss',
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '100%' })),
      transition('* => *', animate('500ms ease-in-out')),
    ])
  ]
})
export class ImageComponent implements OnInit, OnDestroy {

  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef;
  length = 0;
  sourceX = 0;
  sourceY = 0;

   // Propriétés pour le redimensionnement
    isResizing = false;
    panelHeight = 50; // Largeur par défaut
    minHeight = 40;   // Largeur minimum
    maxHeight = 70;   // Largeur maximum
  
    // Références aux fonctions liées pour éviter de créer de nouvelles instances
    private boundMouseMove!: (event: MouseEvent) => void;
    private boundMouseUp!: (event: MouseEvent) => void;
    private boundTouchMove!: (event: TouchEvent) => void;
    private boundTouchEnd!: (event: TouchEvent) => void;

  constructor(
    private el: ElementRef,
    private cdr: ChangeDetectorRef,
    private imageService: ImageService,
    private georefService: GeorefService,
    private gcpService: GcpService,
    private mapService: MapService,
    private dialog: MatDialog,
  ) {
    // Lier les méthodes une seule fois
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
  }

  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }

  get isAddingGCP() {
    return this.gcpService.isAddingGCP;
  }

  ngOnInit(): void {
    this.imageService.initImageLayer('image-map');
    this.imageService.imageLayers$.subscribe(() => {
      console.log("On Image Map : ", this.imageService.getImageMap()!.getLayers().getArray());
      this.imageService.syncImageLayers();
    });
    this.gcpService.cursorCoordinates.subscribe((coords) => {
      if (this.isAddingGCP) {
        this.sourceX = coords.x;
        this.sourceY = coords.y;
      }
    });
    this.gcpService.gcps$.subscribe((gcps) => {
      this.length = gcps.length;
    })

    // Ajouter les écouteurs d'événements pour le redimensionnement
    this.setupResizeListeners();
  }

  ngOnDestroy(): void {
    // Supprimer les écouteurs d'événements
    this.removeResizeListeners();
  }

  private setupResizeListeners(): void {
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('mouseleave', this.boundMouseUp);
    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
    document.addEventListener('touchcancel', this.boundTouchEnd);
  }

  private removeResizeListeners(): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('mouseleave', this.boundMouseUp);
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
    document.removeEventListener('touchcancel', this.boundTouchEnd);
  }

  startResize(event: MouseEvent | TouchEvent): void {
    if (!this.isGeorefActive) return;

    event.preventDefault();
    this.isResizing = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    // Ajouter les écouteurs seulement quand le redimensionnement commence
    this.setupResizeListeners();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    const windowHeight = window.innerHeight;
    const newHeight = windowHeight - event.clientY;

    this.updateHeight(newHeight);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isResizing) return;

    event.preventDefault();
    const touch = event.touches[0];
    const windowHeight = window.innerHeight;
    const newHeight = windowHeight - touch.clientY;

    this.updateHeight(newHeight);
  }

  onMouseUp(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Supprimer les écouteurs quand le redimensionnement est terminé
    this.removeResizeListeners();
  }

  onTouchEnd(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    document.body.style.userSelect = '';

    // Supprimer les écouteurs quand le redimensionnement est terminé
    this.removeResizeListeners();
  }

  private updateHeight(newHeight: number): void {
    // Calculer la hauteur en pourcentage par rapport à la hauteur de la fenêtre
    const heightPercent = (newHeight / window.innerHeight) * 100;

    // Limiter la hauteur entre min et max
    const constrainedHeight = Math.min(Math.max(heightPercent, this.minHeight), this.maxHeight);
    this.panelHeight = constrainedHeight;
    this.cdr.detectChanges();

    // Mettre à jour directement le style si le conteneur existe
    if (this.imageContainer) {
      this.imageContainer.nativeElement.style.height = `${constrainedHeight}%`;
    }
  }

  zoomIn(): void {
    this.imageService.zoomIn();
  }

  zoomOut(): void {
    this.imageService.zoomOut();
  }

  resetView(): void {
    this.imageService.resetView();
  }

  onImageKeydown(event: KeyboardEvent): void {
    if (event.key === 'a') {
      console.log('🟢 Ajout de GCP activé');
    }
  }

  onImageClick(): void {
    if (!this.isAddingGCP) return;

    const newGcpLayer = this.imageService.createGcpLayer();
    this.imageService.addGcpLayerToList(newGcpLayer);

    // Ouvrir le dialogue pour la sélection de la méthode
    const dialogRef = this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Créer un GCP avec les coordonnées destinations
        const newGcp = this.gcpService.createGCP(this.sourceX, this.sourceY, result.mapX, result.mapY);
        this.gcpService.addGcpToList(newGcp);
        const newGcpLayer = this.mapService.createGcpLayer(result.mapX, result.mapY);
        this.mapService.addGcpLayerToList(newGcpLayer);
      }
      this.gcpService.isAddingGCP = false;
    });
  }

}
