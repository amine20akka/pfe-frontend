import { Component, OnInit } from '@angular/core';
import { MapService } from '../../services/map.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  imports: [CommonModule],
})
export class MapComponent implements OnInit {
  isMapSelection = false;
  cursorX = 0;
  cursorY = 0;

  constructor(private mapService: MapService) {}

  ngOnInit(): void {
    this.mapService.initMap('map');
    this.mapService.isMapSelection$.subscribe(value => {
      this.isMapSelection = value;
    });

    // S'abonner aux coordonnées du curseur
    this.mapService.mapCoordinates$.subscribe(coords => {
      this.cursorX = coords.x;
      this.cursorY = coords.y;
    });
  }
}