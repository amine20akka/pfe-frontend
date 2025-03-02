import { Component, OnDestroy, OnInit } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { UploadComponent } from '../upload/upload.component';
import { ImageComponent } from '../image/image.component';
import { ImageService } from '../../services/image.service';
import { Subscription } from 'rxjs';
import { GcpComponent } from "../gcp/gcp.component";
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { GcpService } from '../../services/gcp.service';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-georef',
  templateUrl: './georef.component.html',
  styleUrls: ['./georef.component.scss'],
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    UploadComponent,
    ImageComponent,
    GcpComponent,
    ToolbarComponent,
    MatProgressSpinnerModule,
  ],
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '47%' })),
      transition('* => *', animate('500ms ease-in-out')),
    ])
  ]
})
export class GeorefComponent implements OnInit, OnDestroy {

  cursorX = 0;
  cursorY = 0;
  private coordSub!: Subscription;

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService,
    private gcpService: GcpService,
  ) { }

  ngOnInit(): void {
    // S'abonner aux coordonnées du curseur
    this.coordSub = this.gcpService.cursorCoordinates.subscribe(coords => {
      this.cursorX = parseFloat(coords.x.toFixed(4));
      this.cursorY = parseFloat(coords.y.toFixed(4));
    });
  }

  ngOnDestroy() {
    // Nettoyer la souscription pour éviter les fuites de mémoire
    if (this.coordSub) {
      this.coordSub.unsubscribe();
    }
  }

  get isGeorefActive(): boolean {
    return this.georefService.isGeorefActive;
  }

  get isImageLoaded(): boolean {
    return this.imageService.isImageLoaded;
  }

  get isLoading(): boolean {
    return this.imageService.isLoading;
  }

  toggleGeoref(): void {
    this.georefService.toggleGeoref();
  }

}
