import { AfterViewInit, Component } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';

@Component({
  selector: 'app-image',
  imports: [],
  templateUrl: './image.component.html',
  styleUrl: './image.component.scss',
  animations: [
      trigger('toggleContent', [
        state('closed', style({ width: '0' })),
        state('open', style({ width: '97%' })),
        transition('* => *', animate('500ms ease-in-out')),
      ])
  ]
})
export class ImageComponent implements AfterViewInit {

  constructor(private imageService: ImageService, private georefService: GeorefService) { }

  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }
  
  ngAfterViewInit() {
    this.imageService.initImageLayer();
  }

}
