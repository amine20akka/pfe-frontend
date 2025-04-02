import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { GeorefService } from '../../services/georef.service';
import { PanelPosition } from '../../models/panel-position';

// Type pour les coins d'ancrage
type AnchorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

@Component({
  selector: 'app-draw-panel',
  imports: [
    DragDropModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CommonModule
  ],
  templateUrl: './draw-panel.component.html',
  styleUrl: './draw-panel.component.scss'
})
export class DrawPanelComponent implements OnInit {

  constructor(private georefService: GeorefService) { }

  // Propriétés pour l'ancrage aux coins
  panelPosition: PanelPosition = { top: 10, left: 70 };
  currentAnchor: AnchorPosition = 'top-left'; // Par défaut

  ngOnInit() {
    // Récupérer uniquement l'ancrage sauvegardé
    const savedAnchor = localStorage.getItem('drawingToolsPanelAnchor');

    if (savedAnchor) {
      this.currentAnchor = savedAnchor as AnchorPosition;
      this.updatePositionFromAnchor();
    } else {
      // Si pas d'ancrage sauvegardé, définir l'ancrage par défaut
      this.anchorToCorner('top-left');
    }
  }

  get isDrawToolsActive(): boolean {
    return this.georefService.isDrawToolsActive;
  }

  get anchoredClass(): Record<string, boolean> {
    return {
      [`anchored-${this.currentAnchor}`]: true
    };
  }

  toggleDrawTools(): void {
    this.georefService.toggleDrawTools();
  }

  selectDrawTool(tool: string) {
    console.log('Outil de dessin sélectionné:', tool);
  }

  // Gérer la fin du drag pour déterminer le coin le plus proche
  onDragEnded(event: CdkDragEnd) {
    // Obtenir les dimensions de la fenêtre
    const windowWidth = window.innerWidth;

    // Récupérer les dimensions du panneau
    const panelElement = event.source.element.nativeElement;
    const panelWidth = panelElement.offsetWidth;

    // Position actuelle après le drag
    const x = event.source.getFreeDragPosition().x;

    // Calculer la position absolue sur l'écran en tenant compte de l'ancrage actuel
    let absoluteX = 0;
    if (this.panelPosition.left !== undefined) {
      // Si le panneau est ancré à gauche
      absoluteX = x + this.panelPosition.left;
    } else if (this.panelPosition.right !== undefined) {
      // Si le panneau est ancré à droite
      absoluteX = windowWidth - this.panelPosition.right - panelWidth + x;
    }

    // Calculer les distances aux coins supérieurs
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

  // Ancrer le panneau à un coin spécifique
  anchorToCorner(corner: AnchorPosition) {
    this.currentAnchor = corner;
    this.updatePositionFromAnchor();
    this.savePosition();
  }

  // Mettre à jour la position en fonction de l'ancrage
  private updatePositionFromAnchor() {
    const safeMargin = 10; // marge de sécurité

    // Définir les positions en fonction du coin
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

  // Sauvegarder uniquement l'état d'ancrage
  savePosition() {
    localStorage.setItem('drawingToolsPanelAnchor', this.currentAnchor);
  }
}