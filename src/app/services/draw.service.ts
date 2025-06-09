import { Injectable } from '@angular/core';
import { PanelPosition } from '../interfaces/panel-position';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

type AnchorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

@Injectable({
  providedIn: 'root'
})
export class DrawService {

  panelPosition: PanelPosition = { top: 10, left: 70 };
  currentAnchor: AnchorPosition = 'top-right';

  constructor() {
    const savedAnchor = localStorage.getItem('drawingToolsPanelAnchor');

    if (savedAnchor) {
      this.currentAnchor = savedAnchor as AnchorPosition;
      this.updatePositionFromAnchor();
    } else {
      this.anchorToCorner('top-left');
    }
  }

  
  public getCurrentAnchor() : AnchorPosition {
    return this.currentAnchor;
  }
  
  public getPanelPosition() : PanelPosition {
    return this.panelPosition;
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