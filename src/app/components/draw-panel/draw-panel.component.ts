import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { GeorefService } from '../../services/georef.service';
import { PanelPosition } from '../../interfaces/panel-position';
import { DrawService } from '../../services/draw.service';
import { DrawMode, DrawModes } from '../../interfaces/draw-mode';
import { EntityMode, EntityModes } from '../../enums/entity-modes';
import { MapService } from '../../services/map.service';

type AnchorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

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
    private drawService: DrawService,
    private mapService: MapService,
  ) { }

  activeDrawTool: DrawMode | null = null;
  activeEntityMode: EntityMode | null = null;
  DrawModes = DrawModes;
  EntityModes = EntityModes;
  panelPosition: PanelPosition = { top: 10, left: 70 };
  currentAnchor: AnchorPosition = 'top-right';
  isModifying = false;

  ngOnInit() {
    const savedAnchor = localStorage.getItem('drawingToolsPanelAnchor');

    if (savedAnchor) {
      this.currentAnchor = savedAnchor as AnchorPosition;
      this.updatePositionFromAnchor();
    } else {
      this.anchorToCorner('top-left');
    }

    this.drawService.activeDrawTool$.subscribe((tool) => {
      this.activeDrawTool = tool;
      if (tool == null) {
        this.activeEntityMode = null;
      }
    });

    this.mapService.sidebarVisible$.subscribe((visible: boolean) => {
      this.isModifying = visible;
    });
  }

  get isDrawPanelActive(): boolean {
    return this.georefService.isDrawPanelActive;
  }

  get anchoredClass(): Record<string, boolean> {
    return {
      [`anchored-${this.currentAnchor}`]: true
    };
  }

  toggleEntityMode(mode: EntityMode | null): void {
    if (mode === null) {
      this.activeEntityMode = null;
      this.drawService.clearDrawInteractions();
      this.mapService.dismissSelectSnackbar();
      this.mapService.deactivateHoverInteraction();
      this.georefService.toggleDrawPanel(null);
      return;
    }

    if (mode === this.activeEntityMode) {
      this.activeEntityMode = null;
      this.mapService.dismissSelectSnackbar();
      this.mapService.disableSelectInteraction();
      return;
    }

    this.drawService.clearDrawInteractions();
    this.mapService.dismissDrawSnackbar();
    this.activeDrawTool = null;

    this.activeEntityMode = mode;

    switch (mode) {
      case EntityModes.ADD:
        console.log('Mode ajout d\'entité activé');
        break;
      case EntityModes.SELECT:
        this.mapService.enableSelectInteraction();
        break;
    }
  }

  addEntity(): void {
    console.log('Ajout d\'une nouvelle entité');
  }

  onDragEnded(event: CdkDragEnd) {
    const windowWidth = window.innerWidth;

    const panelElement = event.source.element.nativeElement;
    const panelWidth = panelElement.offsetWidth;

    const x = event.source.getFreeDragPosition().x;

    let absoluteX = 0;
    if (this.panelPosition.left !== undefined) {
      absoluteX = x + this.panelPosition.left;
    } else if (this.panelPosition.right !== undefined) {
      absoluteX = windowWidth - this.panelPosition.right - panelWidth + x;
    }

    const distanceToLeft = absoluteX;
    const distanceToRight = windowWidth - absoluteX - panelWidth;

    const distances = [
      { corner: 'top-left', distance: distanceToLeft },
      { corner: 'top-right', distance: distanceToRight },
    ];

    // Trier par distance et prendre le plus proche
    const closestCorner = distances.sort((a, b) => a.distance - b.distance)[0].corner as AnchorPosition;

    // Ancrer au coin le plus proche
    this.anchorToCorner(closestCorner);

    // Réinitialiser la position du drag pour éviter l'accumulation
    event.source.reset();
  }

  anchorToCorner(corner: AnchorPosition) {
    this.currentAnchor = corner;
    this.updatePositionFromAnchor();
    this.savePosition();
  }

  private updatePositionFromAnchor() {
    const safeMargin = 10;

    switch (this.currentAnchor) {
      case 'top-left':
        this.panelPosition = {
          top: safeMargin,
          left: 70,
          right: undefined,
          bottom: undefined
        };
        break;
      case 'top-right':
        this.panelPosition = {
          top: safeMargin,
          left: undefined,
          right: safeMargin,
          bottom: undefined
        };
        break;
    }
  }

  savePosition() {
    localStorage.setItem('drawingToolsPanelAnchor', this.currentAnchor);
  }
}