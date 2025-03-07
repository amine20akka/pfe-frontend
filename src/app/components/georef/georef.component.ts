import { Component, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
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
import { GeorefSettings } from '../../interfaces/georef-settings';
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
      state('open', style({ width: '{{panelWidth}}px' }), { params: { panelWidth: 600 } }),
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
  
  // Propriétés pour le redimensionnement
  isResizing = false;
  panelWidth = 600; // Largeur par défaut
  minWidth = 550;   // Largeur minimum
  maxWidth = 1000;   // Largeur maximum

  constructor(
    private georefService: GeorefService,
    private imageService: ImageService,
    private gcpService: GcpService,
    private georefSettingsService: GeorefSettingsService,
    private el: ElementRef
  ) { }

  ngOnInit(): void {
    // S'abonner aux coordonnées du curseur
    this.coordSub = this.gcpService.cursorCoordinates.subscribe(coords => {
      this.cursorX = parseFloat(coords.x.toFixed(4));
      this.cursorY = parseFloat(coords.y.toFixed(4));
    });

    // Observer les paramètres de géoréférencement
    this.georefSettingsService.settings$.subscribe(settings => {
      this.georefSettings = settings;
    });

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
    
    const windowWidth = window.innerWidth;
    const newWidth = windowWidth - event.clientX;
    
    this.updateWidth(newWidth);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isResizing) return;
    
    event.preventDefault();
    const touch = event.touches[0];
    const windowWidth = window.innerWidth;
    const newWidth = windowWidth - touch.clientX;
    
    this.updateWidth(newWidth);
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

  private updateWidth(newWidth: number): void {
    // Limiter la largeur entre min et max
    const constrainedWidth = Math.min(Math.max(newWidth, this.minWidth), this.maxWidth);
    this.panelWidth = constrainedWidth;
    
    // Mettre à jour directement le style si le panneau est ouvert
    if (this.georefContainer) {
      this.georefContainer.nativeElement.style.width = `${constrainedWidth}px`;
    }
  }

  get isGeorefActive(): boolean {
    return this.georefService.isGeorefActive;
  }

  get isImageLoaded(): boolean {
    return this.imageService.isImageLoaded;
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