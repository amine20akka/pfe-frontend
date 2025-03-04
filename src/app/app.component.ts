import { Component } from '@angular/core';
import { SidenavComponent } from './components/sidenav/sidenav.component';
import { MapComponent } from './components/map/map.component';
import { GeorefComponent } from "./components/georef/georef.component";

@Component({
  selector: 'app-root',
  imports: [SidenavComponent, MapComponent, GeorefComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'georef-frontend';
}
