import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { GCP } from '../../models/gcp.model';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GeorefService } from '../../services/georef.service';
import { GcpService } from '../../services/gcp.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog-data';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { colors } from '../../shared/colors';
import { LayerService } from '../../services/layer.service';

@Component({
  selector: 'app-gcp',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    CommonModule,
    MatCheckboxModule,
    MatTooltipModule,
    ReactiveFormsModule,
    MatInputModule,
  ],
  templateUrl: './gcp.component.html',
  styleUrl: './gcp.component.scss',
})

export class GcpComponent implements OnInit, OnDestroy {
  @ViewChild('tableContainer', { static: false }) tableContainer!: ElementRef;
  @ViewChild('anchorZone', { static: true }) anchorZone!: ElementRef;

  constructor(
    private georefService: GeorefService,
    private gcpService: GcpService,
    private layerService: LayerService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private renderer: Renderer2,
    private el: ElementRef,
    private ngZone: NgZone
  ) { }

  displayedColumns: string[] = ['select', 'index', 'sourceX', 'sourceY', 'mapX', 'mapY', 'residual', 'edit', 'delete'];
  dataSource = new MatTableDataSource<GCP>();
  selection = new SelectionModel<string>(true, []);
  sourceXControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  sourceYControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  mapXControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  mapYControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  private imageLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private mapLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();

  editingGcpIndex: number | null = null;
  editForm!: FormGroup;

  isDragging = false;
  isFloating = false;
  isNearOriginalPosition = false;
  private isResizing = false;
  private resizeDirection: 'right' | 'bottom' | 'both' = 'both';
  private startWidth!: number;
  private startHeight!: number;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private lastX = 0;
  private lastY = 0;
  private originalPosition = { top: 0, left: 0, width: 0, height: 0 };
  private resetThreshold = 150;
  private isInitialLoad = true;

  ngOnInit() {
    this.editForm = this.fb.group({
      sourceX: this.sourceXControl,
      sourceY: this.sourceYControl,
      mapX: this.mapXControl,
      mapY: this.mapYControl,
    });

    this.gcpService.gcps$.subscribe((gcps) => {
      this.dataSource.data = gcps;

      if (gcps.length === 0) {
        this.selection.clear();
      } else if (this.isInitialLoad) {
        this.dataSource.data.forEach(gcp => {
          this.selection.select(gcp.id);
        });
        
        this.isInitialLoad = false;
      } else {
        this.selection.select(gcps[gcps.length-1].id);
      }

      setTimeout(() => {
        this.updateGcpLayerVisibility();
      }, 300);
      console.log('GCPs Data : ', gcps);
    });

    this.layerService.imageLayers$.subscribe((imageLayers) => {
      this.imageLayers = imageLayers;
      console.log('GCPs Image Layers : ', imageLayers);
    });

    this.layerService.mapLayers$.subscribe((mapLayers) => {
      this.mapLayers = mapLayers;
      console.log('GCPs Map Layers : ', mapLayers);
    });

    this.gcpService.isFloating$.subscribe(value => this.isFloating = value);
    this.gcpService.isNearOriginalPosition$.subscribe(value => this.isNearOriginalPosition = value);

    this.dataSource.connect().subscribe(() => {
      setTimeout(() => this.updateTableDimensions(), 0);
    });

    setTimeout(() => {
      const element = this.el.nativeElement.querySelector('.table-container');
      if (element) {
        const rect = element.getBoundingClientRect();
        this.originalPosition = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        };
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.gcpService.isAddingGCP = false;
  }

  get isGeorefActive(): boolean {
    return this.georefService.isGeorefActive;
  }

  get loadingGCPs(): boolean {
    return this.gcpService.loadingGCPs;
  }

  toggleAddingGCP(): void {
    this.gcpService.toggleAddingGcp();
  }

  startResize(event: MouseEvent | TouchEvent, direction: 'right' | 'bottom' | 'both'): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    this.resizeDirection = direction;

    const element = this.el.nativeElement.querySelector('.table-container');
    const rect = element.getBoundingClientRect();

    if (event instanceof MouseEvent) {
      this.startX = event.clientX;
      this.startY = event.clientY;
    } else {
      this.startX = event.touches[0].clientX;
      this.startY = event.touches[0].clientY;
    }

    this.startWidth = rect.width;
    this.startHeight = rect.height;

    // Ajouter la classe de redimensionnement
    this.renderer.addClass(element, 'is-resizing');

    // Ajouter les écouteurs d'événements
    document.addEventListener('mousemove', this.resizeMove);
    document.addEventListener('touchmove', this.resizeMove);
    document.addEventListener('mouseup', this.stopResize);
    document.addEventListener('touchend', this.stopResize);
  }

  resizeMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.isResizing) return;

    let clientX: number, clientY: number;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      event.preventDefault(); // Empêcher le défilement sur mobile
    }

    const dx = clientX - this.startX;
    const dy = clientY - this.startY;
    const element = this.el.nativeElement.querySelector('.table-container');

    // Appliquer le redimensionnement selon la direction
    if (this.resizeDirection === 'right' || this.resizeDirection === 'both') {
      const newWidth = Math.max(this.startWidth + dx, 200); // Largeur minimale de 200px
      this.renderer.setStyle(element, 'width', `${newWidth}px`);
    }

    if (this.resizeDirection === 'bottom' || this.resizeDirection === 'both') {
      const newHeight = Math.max(this.startHeight + dy, 100); // Hauteur minimale de 100px
      this.renderer.setStyle(element, 'height', `${newHeight}px`);
    }
  }

  stopResize = (): void => {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.resizeDirection = 'both';

    const element = this.el.nativeElement.querySelector('.table-container');
    this.renderer.removeClass(element, 'is-resizing');

    document.removeEventListener('mousemove', this.resizeMove);
    document.removeEventListener('touchmove', this.resizeMove);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('touchend', this.stopResize);
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = true;

    if (event instanceof MouseEvent) {
      this.startX = event.clientX;
      this.startY = event.clientY;
    } else {
      this.startX = event.touches[0].clientX;
      this.startY = event.touches[0].clientY;
    }

    const element = this.el.nativeElement.querySelector('.table-container');
    const rect = element.getBoundingClientRect();

    if (!this.isFloating) {
      // If not yet floating, initialize current positions
      this.lastX = rect.left;
      this.lastY = rect.top;

      // Save original position explicitly to avoid reference issues
      this.originalPosition = {
        left: rect.left,
        top: rect.top,
        height: rect.height,
        width: rect.width
      };

      // Make the table floating with computed dimensions
      this.renderer.setStyle(element, 'position', 'fixed');
      this.renderer.setStyle(element, 'z-index', '3000');
      this.renderer.setStyle(element, 'box-shadow', '0 4px 8px rgba(0, 0, 0, 0.2)');
      this.renderer.setStyle(element, 'width', `${rect.width}px`);
      this.renderer.setStyle(element, 'height', `${rect.height}px`);
      this.renderer.setStyle(element, 'left', `${rect.left}px`);
      this.renderer.setStyle(element, 'top', `${rect.top}px`);
      this.gcpService.updateFloatingStatus(true);
    }

    this.currentX = this.lastX;
    this.currentY = this.lastY;

    // Add event listeners
    document.addEventListener('mousemove', this.dragMove);
    document.addEventListener('touchmove', this.dragMove);
    document.addEventListener('mouseup', this.stopDrag);
    document.addEventListener('touchend', this.stopDrag);

    this.renderer.addClass(element, 'is-dragging');
  }

  dragMove = (event: MouseEvent | TouchEvent): void => {
    if (!this.isDragging) return;

    let clientX: number, clientY: number;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      // Empêcher le défilement pendant le drag sur mobile
      event.preventDefault();
    }

    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    // Calculer la nouvelle position
    let newX = this.lastX + dx;
    let newY = this.lastY + dy;

    const element = this.el.nativeElement.querySelector('.table-container');
    const elementRect = element.getBoundingClientRect();
    const dragHandle = this.el.nativeElement.querySelector('.drag-handle') || element;
    const dragHandleRect = dragHandle.getBoundingClientRect();

    // Calcul des dimensions du handle par rapport à l'élément
    const handleOffsetX = dragHandleRect.left - elementRect.left;
    const handleOffsetY = dragHandleRect.top - elementRect.top;
    const handleWidth = dragHandleRect.width;
    const handleHeight = dragHandleRect.height;

    // Obtenir les dimensions de la fenêtre
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculer les marges pour garder le handle visible (au moins 20px du handle doivent rester visibles)
    const minVisiblePx = 0;

    // Contraintes pour la position X
    // Empêcher de dépasser à gauche
    if (newX + handleOffsetX < 0) {
      newX = -handleOffsetX + minVisiblePx;
    }
    // Empêcher de dépasser à droite
    if (newX + handleOffsetX + handleWidth > windowWidth) {
      newX = windowWidth - handleOffsetX - handleWidth - minVisiblePx;
    }

    // Contraintes pour la position Y
    // Empêcher de dépasser en haut
    if (newY + handleOffsetY < 0) {
      newY = -handleOffsetY + minVisiblePx;
    }
    // Empêcher de dépasser en bas
    if (newY + handleOffsetY + handleHeight > windowHeight) {
      newY = windowHeight - handleOffsetY - handleHeight - minVisiblePx;
    }

    // Mettre à jour les positions
    this.currentX = newX;
    this.currentY = newY;

    // Appliquer les nouvelles positions
    this.renderer.setStyle(element, 'left', `${this.currentX}px`);
    this.renderer.setStyle(element, 'top', `${this.currentY}px`);

    // Vérifier si on est proche de la position d'origine
    this.checkIfNearOriginalPosition();
  }

  stopDrag = (): void => {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.lastX = this.currentX;
    this.lastY = this.currentY;

    // Vérifier si la table est proche de sa position d'origine
    if (this.isNearOriginalPosition && this.isGeorefActive) {
      // Retour à la position d'origine
      this.resetPosition();
    }

    // Retirer les event listeners
    document.removeEventListener('mousemove', this.dragMove);
    document.removeEventListener('touchmove', this.dragMove);
    document.removeEventListener('mouseup', this.stopDrag);
    document.removeEventListener('touchend', this.stopDrag);

    // Retirer la classe de drag
    const element = this.el.nativeElement.querySelector('.table-container');
    this.renderer.removeClass(element, 'is-dragging');
  }

  checkIfNearOriginalPosition(): void {
    const element = this.el.nativeElement.querySelector('.table-container');
    const anchorElement = this.el.nativeElement.querySelector('.anchor-zone');
    const wasNear = this.isNearOriginalPosition;

    // Vérifier si on est proche de la position d'origine
    this.gcpService.updateNearOriginalPositionStatus(
      Math.abs(this.currentX - this.originalPosition.left) < this.resetThreshold &&
      Math.abs(this.currentY - this.originalPosition.top) < this.resetThreshold);

    // Si le statut a changé, mettre à jour la classe CSS
    if (wasNear !== this.isNearOriginalPosition) {
      this.ngZone.run(() => {
        if (this.isNearOriginalPosition && this.isGeorefActive) {
          this.renderer.addClass(element, 'near-original-position');
          this.renderer.addClass(anchorElement, 'active');
        } else {
          this.renderer.removeClass(element, 'near-original-position');
          this.renderer.removeClass(anchorElement, 'active');
        }
      });
    }
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.isFloating) {
      this.checkIfNearOriginalPosition();
    }
  }

  resetPosition(): void {
    const element = this.el.nativeElement.querySelector('.table-container');

    // Animation de retour à la position d'origine
    this.renderer.setStyle(element, 'transition', 'left 0.3s ease, top 0.3s ease');
    this.renderer.setStyle(element, 'left', `${this.originalPosition.left}px`);
    this.renderer.setStyle(element, 'top', `${this.originalPosition.top}px`);

    // Retirer le style "fixed" et autres styles de drag après l'animation
    setTimeout(() => {
      this.renderer.removeStyle(element, 'position');
      this.renderer.removeStyle(element, 'z-index');
      this.renderer.removeStyle(element, 'box-shadow');
      this.renderer.removeStyle(element, 'left');
      this.renderer.removeStyle(element, 'top');
      this.renderer.removeStyle(element, 'width');
      this.renderer.removeStyle(element, 'height');
      this.renderer.removeStyle(element, 'transition');
      this.renderer.removeClass(element, 'near-original-position');

      this.gcpService.updateFloatingStatus(false);
      this.gcpService.updateNearOriginalPositionStatus(false);
    }, 300);
  }

  onDoubleClick(): void {
    if (this.isFloating) {
      this.resetPosition();
    }
  }

  onClick(): void {
    if (this.isFloating) {
      this.resetPosition();
    }
  }

  canStartDrag(event: MouseEvent | TouchEvent): boolean {
    const target = event.target as HTMLElement;
    return !this.editingGcpIndex && !target.closest('input') && !target.closest('button');
  }

  updateTableDimensions(): void {
    if (this.isFloating) {
      const element = this.el.nativeElement.querySelector('.table-container');
      const table = element.querySelector('table');

      const dragHandle = element.querySelector('.drag-handle');
      const dragHandleHeight = dragHandle.offsetHeight;

      const contentHeight = table.scrollHeight;
      const maxHeight = window.innerHeight * 0.8; // 80% of viewport height

      const newHeight = Math.min(dragHandleHeight + contentHeight, maxHeight);

      this.renderer.setStyle(element, 'height', `${newHeight}px`);
    }
  }

  /** Vérifie si tous les éléments sont sélectionnés */
  isAllSelected(): boolean {
    return this.selection.selected.length === this.dataSource.data.length;
  }

  /** Sélectionne tous les éléments ou les désélectionne */
  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data.forEach(gcp => this.selection.select(gcp.id));
    }

    this.updateGcpLayerVisibility();
  }

  /** Sélectionne ou désélectionne un point GCP et met à jour la visibilité */
  toggleRow(row: GCP): void {
    this.selection.toggle(row.id);
    this.updateGcpLayerVisibility();
  }

  /** Update GCP layers visibility */
  updateGcpLayerVisibility(): void {
    if (!this.imageLayers) return;

    this.imageLayers.forEach((layer, index) => {
      const gcp = this.dataSource.data.find(g => g.index === index);
      const isVisible = gcp && this.selection.selected.includes(gcp.id);
      layer.setVisible(isVisible!);
    });

    if (!this.mapLayers) return;

    this.mapLayers.forEach((layer, index) => {
      const gcp = this.dataSource.data.find(g => g.index === index);
      const isVisible = gcp && this.selection.selected.includes(gcp.id);
      layer.setVisible(isVisible!);
    });
  }

  deleteGcp(gcp: GCP): void {
    const wasSelected = this.selection.isSelected(gcp.id);

    if (wasSelected) {
      this.selection.deselect(gcp.id);
    }

    this.gcpService.deleteGcpData(gcp.id);
    this.layerService.deleteGcpImageLayer(gcp.index);
    this.layerService.deleteGcpMapLayer(gcp.index);
  }

  /** Commencer l'édition d'un GCP */
  editGcp(gcp: GCP): void {
    if (this.editingGcpIndex !== null) {
      this.cancelEdit();
    }

    this.editingGcpIndex = gcp.index;

    this.editForm.patchValue({
      sourceX: parseFloat(gcp.sourceX.toFixed(4)),
      sourceY: parseFloat(gcp.sourceY.toFixed(4)),
      mapX: parseFloat(gcp.mapX!.toFixed(4)),
      mapY: parseFloat(gcp.mapY!.toFixed(4))
    });
  }

  /** Gérer le double-clic sur une cellule pour éditer */
  onCellDoubleClick(gcp: GCP, column: string): void {
    // Vérifier si la colonne est éditable
    if (['sourceX', 'sourceY', 'mapX', 'mapY'].includes(column)) {
      this.editGcp(gcp);

      // Focus sur le champ concerné
      setTimeout(() => {
        const input = document.getElementById(`edit-${column}`);
        if (input) (input as HTMLInputElement).focus();
      });
    }
  }

  /** Enregistrer les modifications */
  saveEdit(): void {
    if (this.editForm.valid && this.editingGcpIndex !== null) {
      const updatedGcp: GCP = {
        ...this.dataSource.data.find(gcp => gcp.index === this.editingGcpIndex)!,
        sourceX: this.editForm.value.sourceX,
        sourceY: this.editForm.value.sourceY,
        mapX: this.editForm.value.mapX,
        mapY: this.editForm.value.mapY
      };

      this.gcpService.updateGcp(updatedGcp);
      this.editingGcpIndex = null;
    }
  }

  /** Annuler l'édition */
  cancelEdit(): void {
    this.editingGcpIndex = null;
    this.editForm.reset();
  }

  /** Traitement de touche appuyée dans un champ d'édition */
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.saveEdit();
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  trackByFn(index: number): number {
    return index;
  }

  getFillColor(index: number): string {
    return colors[(index - 1) % colors.length].fill;
  }

  getTextColor(index: number): string {
    return colors[(index - 1) % colors.length].text;
  }

  openDeleteConfirmDialog(gcp: GCP): void {
    const dialogData: ConfirmDialogData = {
      title: 'Êtes-vous sûr de supprimer ce point de contrôle ?',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      icon: 'delete'
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deleteGcp(gcp);
      }
    });
  }
}