import { Component, AfterViewInit } from '@angular/core';
import Map from 'ol/Map';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {

  constructor(private mapService: MapService) {}

  ngAfterViewInit(): void {
    this.mapService.initializeMap('map');
  }
}