import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
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
import { LayerService } from '../../services/layer.service';
import { ImageFileService } from '../../services/image-file.service';
import { GcpDto } from '../../dto/gcp-dto';

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
export class ImageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('imageContainer', { static: false }) imageContainer!: ElementRef;
  length = 0;
  sourceX = 0;
  sourceY = 0;
  isFloating = false;
  isNearOriginalPosition = false;

  constructor(
    private layerService: LayerService,
    private imageService: ImageService,
    private imageFileService: ImageFileService,
    private georefService: GeorefService,
    private gcpService: GcpService,
    private dialog: MatDialog,
    private renderer: Renderer2,
  ) { }

  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }

  get isAddingGCP() {
    return this.gcpService.isAddingGCP;
  }

  ngOnInit(): void {

    this.layerService.initImageLayer('image-map');

    this.layerService.imageLayers$.subscribe(() => {
      this.layerService.syncImageLayers();
    });

    this.initGcpTracking();
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

  ngOnDestroy(): void {
    this.imageFileService.clear();
  }

  zoomIn(): void {
    this.layerService.zoomIn();
  }

  zoomOut(): void {
    this.layerService.zoomOut();
  }

  recenterView(): void {
    this.layerService.recenterView();
  }

  private initGcpTracking(): void {
    this.imageFileService.cursorCoordinates.subscribe((coords) => {
      if (this.isAddingGCP) {
        this.sourceX = coords.x;
        this.sourceY = coords.y;
      }
    });

    this.gcpService.gcps$.subscribe((gcps) => {
      this.length = gcps.length;
    });
  }

  onImageKeydown(event: KeyboardEvent): void {
    if (event.key === 'a') {
      console.log('🟢 Ajout de GCP activé');
    }
  }

  onImageClick(): void {
    if (!this.isAddingGCP) return;

    const newGcpLayer = this.layerService.createGcpImageLayer(this.sourceX, this.sourceY);
    this.layerService.addGcpImageLayerToList(newGcpLayer);

    const dialogRef = this.dialog.open(GcpDialogComponent, {
      width: 'auto',
      height: 'auto',
      disableClose: true,
      panelClass: 'custom-dialog',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.gcpService.addGcp(
          this.imageService.getGeorefImage().id,
          this.sourceX,
          this.sourceY,
          result.mapX,
          result.mapY
        ).subscribe((savedGcp: GcpDto | null) => {
          if (savedGcp && savedGcp.mapX && savedGcp.mapY) {
            const newGcpLayer = this.layerService.createGcpMapLayer(savedGcp.mapX, savedGcp.mapY);
            this.layerService.addGcpMapLayerToList(newGcpLayer);
          }
        });

      }
      this.gcpService.isAddingGCP = false;
    });
  }

}
