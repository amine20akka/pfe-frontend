import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
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
export class ImageComponent implements OnInit, OnChanges {
  @Input() height!: number;
  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef;
  length = 0;
  sourceX = 0;
  sourceY = 0;

  constructor(
    private imageService: ImageService,
    private georefService: GeorefService,
    private gcpService: GcpService,
    private mapService: MapService,
    private dialog: MatDialog,
  ) { }

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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['height'] && !changes['height'].firstChange) {
      // Mettre à jour les éléments internes si nécessaire
      if (this.imageContainer) {
        this.imageContainer.nativeElement.style.height = `${this.height}%`;
      }
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
