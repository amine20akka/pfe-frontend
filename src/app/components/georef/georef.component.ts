import { Component, OnDestroy, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { UploadComponent } from '../upload/upload.component';
import { ImageComponent } from '../image/image.component';
import { ImageService } from '../../services/image.service';
import { Subscription } from 'rxjs';
import { GcpComponent } from "../gcp/gcp.component";
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { GcpService } from '../../services/gcp.service';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GeorefSettings } from '../../models/georef-settings';
import { GeorefSettingsService } from '../../services/georef-settings.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-georef',
  templateUrl: './georef.component.html',
  styleUrls: ['./georef.component.scss'],
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    UploadComponent,
    ImageComponent,
    GcpComponent,
    ToolbarComponent,
    MatProgressSpinnerModule,
    MatProgressBarModule,
  ],
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '{{panelWidth}}vw' }), { params: { panelWidth: 47 } }),
      transition('* => *', animate('500ms ease-in-out')),
    ])
  ]
})
export class GeorefComponent implements OnInit, OnDestroy {
  @ViewChild('georefContainer') georefContainer!: ElementRef;

  cursorX = 0;
  cursorY = 0;
  private coordSub!: Subscription;
  georefSettings!: GeorefSettings;
  totalRMSE!: number;

  // Propriétés pour le redimensionnement
  isResizing = false;
  minWidth = 42;   // Largeur minimum
  maxWidth = 80;   // Largeur maximum

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService,
    private gcpService: GcpService,
    private georefSettingsService: GeorefSettingsService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // S'abonner aux coordonnées du curseur
    this.coordSub = this.gcpService.cursorCoordinates.subscribe(coords => {
      this.cursorX = parseFloat(coords.x.toFixed(4));
      this.cursorY = parseFloat(coords.y.toFixed(4));
    });

    // Observer les paramètres de géoréférencement
    this.georefSettingsService.settings$.subscribe(settings => this.georefSettings = settings);

    this.gcpService.totalRMSE$.subscribe(value => this.totalRMSE = value);

    // Ajouter les écouteurs d'événements pour le redimensionnement
    this.setupResizeListeners();
  }

  ngOnDestroy() {
    // Nettoyer la souscription pour éviter les fuites de mémoire
    if (this.coordSub) {
      this.coordSub.unsubscribe();
    }

    // Supprimer les écouteurs d'événements
    this.removeResizeListeners();
  }

  get panelWidth() : number {
    return this.georefService.panelWidth;
  }

  private setupResizeListeners(): void {
    // Ajout d'écouteurs au niveau du document pour la gestion du redimensionnement
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('mouseleave', this.onMouseUp.bind(this));
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.onTouchEnd.bind(this));
    document.addEventListener('touchcancel', this.onTouchEnd.bind(this));
  }

  private removeResizeListeners(): void {
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    document.removeEventListener('mouseleave', this.onMouseUp.bind(this));
    document.removeEventListener('touchmove', this.onTouchMove.bind(this));
    document.removeEventListener('touchend', this.onTouchEnd.bind(this));
    document.removeEventListener('touchcancel', this.onTouchEnd.bind(this));
  }

  startResize(event: MouseEvent | TouchEvent): void {
    if (!this.isGeorefActive) return;

    event.preventDefault();
    this.isResizing = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    // Convertir la position en pourcentage de la largeur de la fenêtre
    const windowWidth = window.innerWidth;
    // Calculer en % de viewport width (vw)
    const newWidthVw = 100 - (event.clientX / windowWidth * 100);

    this.updateWidth(newWidthVw);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isResizing) return;

    event.preventDefault();
    const touch = event.touches[0];
    const windowWidth = window.innerWidth;
    // Calculer en % de viewport width (vw)
    const newWidthVw = 100 - (touch.clientX / windowWidth * 100);

    this.updateWidth(newWidthVw);
  }

  onMouseUp(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  onTouchEnd(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    document.body.style.userSelect = '';
  }

  private updateWidth(newWidthVw: number): void {
    // Limiter la largeur entre min et max (en vw)
    const constrainedWidthVw = Math.min(Math.max(newWidthVw, this.minWidth), this.maxWidth);
    this.georefService.updatePanelWidth(constrainedWidthVw);

    // Mettre à jour directement le style si le panneau est ouvert
    if (this.georefContainer) {
      this.georefContainer.nativeElement.style.width = `${constrainedWidthVw}vw`;
    }
  }

  resetWidth(event: MouseEvent | TouchEvent): void {
    if (!this.isGeorefActive) return;

    event.preventDefault();

    // Réinitialisation à la largeur par défaut
    this.updateWidth(47); // 47 est la valeur par défaut

    // Forcer la fin du redimensionnement si nécessaire
    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  get isGeorefActive(): boolean {
    return this.georefService.isGeorefActive;
  }

  get isImageLoaded(): boolean {
    const value = localStorage.getItem("isImageLoaded");
    return value ? JSON.parse(value) : false;
  }

  get isLoading(): boolean {
    return this.imageService.isLoading;
  }

  get isProcessing(): boolean {
    return this.georefService.isProcessing;
  }

  toggleGeoref(): void {
    this.georefService.toggleGeoref();
  }

  // Récupère les paramètres d'animation pour le trigger
  getAnimationParams() {
    return { panelWidth: this.panelWidth };
  }
}