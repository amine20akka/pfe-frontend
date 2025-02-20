import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { GcpService } from '../../services/gcp.service';
import { CommonModule } from '@angular/common';
import { GcpDialogComponent } from '../gcp-dialog/gcp-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-image',
  imports: [
    CommonModule
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
export class ImageComponent implements AfterViewInit {

  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef;
  x = 0;
  y = 0;

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

  ngAfterViewInit() {
    this.imageService.initImageLayer();
    this.imageService.cursorCoordinates.subscribe((coords) => {
      if (this.isAddingGCP) {
        this.x = coords.x;
        this.y = coords.y;
      }
    });
  }

  onImageKeydown(event: KeyboardEvent) {
    if (event.key === 'a') {
      console.log('🟢 Ajout de GCP activé');
    }
  }

  onImageClick() {
    if (!this.isAddingGCP) return;

    // Ouvrir le dialogue pour la sélection de la méthode
    const dialogRef = this.dialog.open(GcpDialogComponent, {
      width: '400px',
      data: { x: this.x, y: this.y }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.selection === 'map') {
          this.mapService.enableMapSelection();
        } else {
          // Ajouter le GCP via le service
          this.gcpService.addGCP(result.gcp.x, result.gcp.y);
        }
      }
    });
  }

}
