import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { UploadComponent } from '../upload/upload.component';
import { ImageComponent } from '../image/image.component';
import { ImageService } from '../../services/image.service';
import { Subscription } from 'rxjs';
import { GcpComponent } from "../gcp/gcp.component";
import { GCP } from '../../interfaces/gcp';

@Component({
  selector: 'app-georef',
  templateUrl: './georef.component.html',
  styleUrls: ['./georef.component.scss'],
  imports: [
    MatIconModule,
    MatCardModule,
    UploadComponent,
    ImageComponent,
    GcpComponent
  ],
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '47%' })),
      transition('* => *', animate('500ms ease-in-out')),
    ])
  ]
})
export class GeorefComponent implements AfterViewInit, OnDestroy {

  cursorX: number = 0;
  cursorY: number = 0;
  private coordSub!: Subscription;

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService
  ) { }

  ngAfterViewInit(): void {
    // S'abonner aux coordonnées du curseur
    this.coordSub = this.imageService.cursorCoordinates.subscribe(coords => {
      this.cursorX = coords.x;
      this.cursorY = coords.y;
    });
  }

  ngOnDestroy() {
    // Nettoyer la souscription pour éviter les fuites de mémoire
    if (this.coordSub) {
      this.coordSub.unsubscribe();
    }
  }

  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }

  get isImageLoaded() {
    return this.imageService.isImageLoaded;
  }

  toggleGeoref() {
    this.georefService.toggleGeoref();
  }
}
