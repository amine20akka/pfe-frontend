import { Component, OnInit } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GeorefService } from '../../services/georef.service';
import { MatDialog } from '@angular/material/dialog';
import { LayerTableComponent } from "../layer-table/layer-table.component";
import { DrawPanelComponent } from "../draw-panel/draw-panel.component";
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-sidenav',
  imports: [
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatTooltipModule,
    LayerTableComponent,
    DrawPanelComponent
],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss'
})
export class SidenavComponent implements OnInit {

  isModifying = false;

  constructor(
    private georefService: GeorefService,
    private mapService: MapService,
    public dialog: MatDialog,
  ) { }
  
  ngOnInit(): void {
    this.mapService.sidebarVisible$.subscribe((visible: boolean) => {
      this.isModifying = visible;
    });
  }

  get isGeorefActive(): boolean {
    return this.georefService.isGeorefActive;
  }

  get isTableActive(): boolean {
    return this.georefService.isTableActive;
  }

  toggleGeoref(): void {
    this.georefService.toggleGeoref();
  }

  toggleTable(): void {
    this.georefService.toggleTable()
  }
}
