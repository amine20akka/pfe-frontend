import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { GeorefService } from '../../services/georef.service';
import { EntityMode, EntityModes } from '../../enums/entity-modes';
import { MapService } from '../../services/map.service';
import { DrawService } from '../../services/draw.service';
import { PanelPosition } from '../../interfaces/panel-position';

@Component({
  selector: 'app-draw-panel',
  imports: [
    DragDropModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CommonModule,
  ],
  templateUrl: './draw-panel.component.html',
  styleUrl: './draw-panel.component.scss'
})
export class DrawPanelComponent implements OnInit {

  constructor(
    private georefService: GeorefService,
    private mapService: MapService,
    private drawService: DrawService,
  ) { }

  activeEntityMode: EntityMode | null = null;
  EntityModes = EntityModes;
  isModifying = false;

  ngOnInit() {
    this.mapService.activeEntityMode$.subscribe((mode: EntityMode | null) => {
      this.activeEntityMode = mode;
    })

    this.mapService.sidebarVisible$.subscribe((visible: boolean) => {
      this.isModifying = visible;
    });
  }

  get isDrawPanelActive(): boolean {
    return this.georefService.isDrawPanelActive;
  }

  get anchoredClass(): Record<string, boolean> {
    return {
      [`anchored-${this.drawService.getCurrentAnchor()}`]: true
    };
  }

  get panelPosition(): PanelPosition {
    return this.drawService.getPanelPosition();
  }

  toggleEntityMode(mode: EntityMode | null): void {
    if (mode === null) {
      this.mapService.updateActiveEntityMode(null);
      this.mapService.deactivateDrawInteractions();
      this.mapService.dismissSelectSnackbar();
      this.mapService.deactivateHoverInteraction();
      this.mapService.updateDrawingStatus(false);
      this.georefService.toggleDrawPanel(null);
      return;
    }

    if (mode === this.activeEntityMode) {
      this.mapService.updateActiveEntityMode(null);
      this.mapService.deactivateDrawInteractions();
      this.mapService.dismissSelectSnackbar();
      this.mapService.disableSelectInteraction();
      this.mapService.updateDrawingStatus(false);
      return;
    }

    this.mapService.deactivateDrawInteractions();
    this.mapService.dismissDrawSnackbar();
    this.mapService.updateActiveEntityMode(mode);

    switch (mode) {
      case EntityModes.ADD:
        this.handleAddEntityMode();
        break;
      case EntityModes.SELECT:
        this.mapService.updateDrawingStatus(false);
        this.handleEditEntityMode();
        break;
    }
  }
  
  private handleAddEntityMode(): void {    
    this.mapService.enableDrawForActiveLayer();
  }
  
  private handleEditEntityMode(): void {
    this.mapService.enableSelectInteraction();
  }
  

  onDragEnded(event: CdkDragEnd): void {
    this.drawService.onDragEnded(event);
  }

}