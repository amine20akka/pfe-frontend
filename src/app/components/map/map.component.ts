import { Component, AfterViewInit } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions, DblClickDragZoom, DragRotateAndZoom } from 'ol/interaction';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {
  map!: Map;

  ngAfterViewInit(): void {
    this.map = new Map({
      target: 'map',
      interactions: defaultInteractions().extend([
        new DblClickDragZoom(),
        new DragRotateAndZoom(),
      ]),
      layers: [
        new TileLayer({
          source: new OSM({
            attributions: [] // Disabling default attributions
          }),
          properties: { background: true } // Setting the layer as background
        })
      ],
      view: new View({
        center: [0, 0],
        zoom: 3,
        rotation: 0
      }),
      controls: defaultControls({
        zoom: false,
        attribution: false,
        rotate: false,
      })
    });
  }
}
