import { Component } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';

@Component({
  selector: 'app-georef',
  templateUrl: './georef.component.html',
  styleUrls: ['./georef.component.scss'],
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: 'calc(100% - 80px)' })), // Quand le menu est fermé
      state('open', style({ width: '50%' })), // Quand le menu est ouvert
      transition('closed <=> open', [
        animate('2500ms ease-in-out')
      ])
    ])
  ]
})
export class GeorefComponent {

  constructor(private georefService: GeorefService) { }
  
  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }

  toggleGeoref() {
    this.georefService.toggleGeoref();
  }
}
