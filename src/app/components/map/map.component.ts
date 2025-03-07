import { Component, OnInit } from '@angular/core';
import { MapService } from '../../services/map.service';
import { CommonModule } from '@angular/common';
import { GeoserverService } from '../../services/geoserver.service';
import { ImageService } from '../../services/image.service';

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

  constructor(
    private mapService: MapService,
    private imageService: ImageService,
    private geoserverService: GeoserverService
  ) {}

  ngOnInit(): void {
    this.mapService.initMap('map');
    this.mapService.mapLayers$.subscribe(() => {
      console.log("On Map : ", this.mapService.getMap()!.getLayers().getArray());
      this.mapService.syncMapLayers();
    });

    this.mapService.georefLayers$.subscribe((georefLayers) => {
      georefLayers.forEach((georefLayer) => {
        this.mapService.addLayerToMap(georefLayer.layer);
      })
    })
    
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