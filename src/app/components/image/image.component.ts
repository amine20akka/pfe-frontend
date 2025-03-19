import { AfterViewInit, Component, ElementRef, OnInit, Renderer2, ViewChild } from '@angular/core';
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
export class ImageComponent implements OnInit, AfterViewInit {
  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef;
  length = 0;
  sourceX = 0;
  sourceY = 0;
  isFloating = false;
  isNearOriginalPosition = false;

  constructor(
    private imageService: ImageService,
    private georefService: GeorefService,
    private gcpService: GcpService,
    private mapService: MapService,
    private dialog: MatDialog,
    private renderer: Renderer2,
  ) { }

  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }

  get isAddingGCP() {
    return this.gcpService.isAddingGCP;
  }

  get imageHeight() {
    return this.imageService.imageHeight;
  }

  get loadingGCPs(): boolean {
    return this.gcpService.loadingGCPs;
  }

  ngOnInit(): void {
    this.imageService.initImageLayer('image-map');
    this.imageService.imageLayers$.subscribe(() => {
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
  }
  
  ngAfterViewInit(): void {
    this.gcpService.isFloating$.subscribe(value => this.isFloating = value);
    this.gcpService.isNearOriginalPosition$.subscribe(value => {
      this.isNearOriginalPosition = value;
      if (this.isFloating && !this.isNearOriginalPosition) {
        this.renderer.addClass(this.imageContainer.nativeElement, 'extended');
      } else {
        this.renderer.removeClass(this.imageContainer.nativeElement, 'extended');
      }
    });
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

    const newGcpLayer = this.imageService.createGcpLayer(this.sourceX, this.sourceY + this.imageHeight);
    this.imageService.addGcpLayerToList(newGcpLayer);

    // Ouvrir le dialogue pour la sélection de la méthode
    const dialogRef = this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true,
      panelClass: 'custom-dialog',
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
