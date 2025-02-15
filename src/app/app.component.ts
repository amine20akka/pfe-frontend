import { Component } from '@angular/core';
import { SidenavComponent } from './shared/components/sidenav/sidenav.component';
import { MapComponent } from './components/map/map.component';

@Component({
  selector: 'app-root',
  imports: [ SidenavComponent, MapComponent ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'georef-frontend';
}
