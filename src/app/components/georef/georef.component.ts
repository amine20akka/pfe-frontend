import { Component } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { UploadComponent } from '../upload/upload.component';
import { ImageComponent } from '../image/image.component';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-georef',
  templateUrl: './georef.component.html',
  styleUrls: ['./georef.component.scss'],
  imports: [
      MatIconModule,
      MatCardModule,
      UploadComponent,
      ImageComponent,
  ],
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '45%' })),
      transition('* => *', animate('500ms ease-in-out')),
    ])
  ]
})
export class GeorefComponent {
  
  constructor(
    private georefService: GeorefService, 
    private imageService: ImageService
  ) { }
  
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
