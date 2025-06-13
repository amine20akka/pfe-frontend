import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
import { MatCardModule } from '@angular/material/card';
import { MockLayer } from '../../interfaces/mock-layer';

@Component({
  selector: 'app-draw-panel',
  imports: [
    DragDropModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CommonModule,
    MatCardModule,
  ],
  templateUrl: './draw-panel.component.html',
  styleUrl: './draw-panel.component.scss'
})
export class DrawPanelComponent implements OnInit, AfterViewInit {
  @ViewChild('hoverPopup') hoverPopupElement!: ElementRef;
  @ViewChild('hoverPopupContent') hoverPopupContentElement!: ElementRef;

  constructor(
    private georefService: GeorefService,
    private mapService: MapService,
    private drawService: DrawService,
  ) { }

  activeEntityMode: EntityMode | null = null;
  EntityModes = EntityModes;
  isModifying = false;
  private editLayer: MockLayer| null = null;

  ngOnInit() {
    this.drawService.activeEntityMode$.subscribe((mode: EntityMode | null) => {
      this.activeEntityMode = mode;
    })

    this.drawService.sidebarVisible$.subscribe((visible: boolean) => {
      this.isModifying = visible;
      if (!visible && this.editLayer) {
        this.mapService.initHoverInteraction(this.editLayer!.wfsLayer, this.hoverPopupElement, this.hoverPopupContentElement);
      }
    });
  }

  ngAfterViewInit(): void {
    this.mapService.initOverlays(this.hoverPopupElement);
    this.drawService.editLayer$.subscribe((layer: MockLayer | null) => {
      this.editLayer = layer;
      if (layer) {
        this.mapService.initHoverInteraction(layer.wfsLayer, this.hoverPopupElement, this.hoverPopupContentElement);
      } else {
        this.mapService.deactivateHoverInteraction();
      }
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
      this.mapService.setDefaultMapCursor();
      this.drawService.updateActiveEntityMode(null);
      this.mapService.deactivateDrawInteractions();
      this.drawService.dismissSelectSnackbar();
      this.mapService.deactivateHoverInteraction();
      this.drawService.updateDrawingStatus(false);
      this.georefService.toggleDrawPanel(null);
      return;
    }

    if (mode === this.activeEntityMode) {
      this.mapService.setDefaultMapCursor();
      this.drawService.updateActiveEntityMode(null);
      this.mapService.deactivateDrawInteractions();
      this.drawService.dismissSelectSnackbar();
      this.mapService.disableSelectInteraction();
      this.mapService.initHoverInteraction(this.editLayer!.wfsLayer, this.hoverPopupElement, this.hoverPopupContentElement);
      this.drawService.updateDrawingStatus(false);
      return;
    }

    this.mapService.disableSelectInteraction();
    this.drawService.dismissSelectSnackbar();
    this.mapService.deactivateDrawInteractions();
    this.drawService.dismissDrawSnackbar();
    this.drawService.updateActiveEntityMode(mode);
    this.mapService.initHoverInteraction(this.editLayer!.wfsLayer, this.hoverPopupElement, this.hoverPopupContentElement);

    switch (mode) {
      case EntityModes.ADD:
        this.handleAddEntityMode();
        break;
      case EntityModes.SELECT:
        this.drawService.updateDrawingStatus(false);
        this.handleEditEntityMode();
        break;
    }
  }
  
  private handleAddEntityMode(): void {    
    this.drawService.enableDrawForActiveLayer();
  }
  
  private handleEditEntityMode(): void {
    this.drawService.enableSelectInteraction();
  }
  
  onDragEnded(event: CdkDragEnd): void {
    this.drawService.onDragEnded(event);
  }

}