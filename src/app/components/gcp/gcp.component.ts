import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { GCP } from '../../interfaces/gcp';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';
import { GcpService } from '../../services/gcp.service';
import { ImageService } from '../../services/image.service';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { MapService } from '../../services/map.service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogData } from '../../interfaces/confirm-dialog-data';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

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
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '100%' })),
      transition('* => *', animate('500ms ease-in-out')),
    ]),
  ]
})

export class GcpComponent implements OnInit, OnDestroy {

  constructor(
    private georefService: GeorefService,
    private gcpService: GcpService,
    private imageService: ImageService,
    private mapService: MapService,
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) { }

  displayedColumns: string[] = ['select', 'index', 'sourceX', 'sourceY', 'mapX', 'mapY', 'residual', 'edit', 'delete'];
  dataSource = new MatTableDataSource<GCP>();
  selection = new SelectionModel<GCP>(true, []);
  isDeleting = false;
  sourceXControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  sourceYControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  mapXControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  mapYControl = new FormControl('', [Validators.required, Validators.nullValidator]);
  private imageLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  private mapLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  
  // Variables pour l'édition
  editingGcpId: number | null = null;
  editForm!: FormGroup;


  ngOnInit() {
    // Initialiser le formulaire d'édition
    this.editForm = this.fb.group({
      sourceX: this.sourceXControl,
      sourceY: this.sourceYControl,
      mapX: this.mapXControl,
      mapY: this.mapYControl,
    });
    
    this.gcpService.gcps$.subscribe((gcps) => {
      if (gcps.length === 0) {
        this.selection.clear();
      }
      this.dataSource.data = gcps;
      // Sélectionner automatiquement les nouveaux GCPs et les rendre visibles
      if (gcps.length > 0 && !this.isDeleting) {
        this.selection.select(gcps[gcps.length - 1]);
      }
      
      setTimeout(() => {
        // Restaurer la sélection depuis le stockage local
        const savedSelection = localStorage.getItem('selectedGCPs');
        if (savedSelection) {
          const selectedIndexes: number[] = JSON.parse(savedSelection);
          selectedIndexes.forEach(index => {
            const gcp = gcps.find(g => g.index === index);
            if (gcp) this.selection.select(gcp);
            const gcpLayer = this.imageLayers.get(index);
            if (gcpLayer) gcpLayer.setVisible(true);
          });
        }
        this.updateGcpLayerVisibility();
      }, 300);
      
      // Update residual values
      // if (gcps.length >= 3) {
      //   this.gcpService.updateGcpsAndResiduals();
      // } else {
      //   this.dataSource.data.forEach((gcp) => {
      //     gcp.residual = undefined;
      //   })
      // }
      console.log('GCPs Data : ', gcps);
      console.log('GCPs Selection : ', this.selection);
    });
    this.imageService.imageLayers$.subscribe((imageLayers) => {
      this.imageLayers = imageLayers;
      console.log('GCPs Image Layers : ', imageLayers);
    });
    this.mapService.mapLayers$.subscribe((mapLayers) => {
      this.mapLayers = mapLayers;
      console.log('GCPs Map Layers : ', mapLayers);
    });
  }

  ngOnDestroy(): void {
    this.gcpService.isAddingGCP = false;
    // Sauvegarde de l'état de la sélection
    const selectedIndexes = this.selection.selected.map(gcp => gcp.index);
    localStorage.setItem('selectedGCPs', JSON.stringify(selectedIndexes));
  }

  get isGeorefActive(): boolean {
    return this.georefService.isGeorefActive;
  }

  /** Vérifie si tous les éléments sont sélectionnés */
  isAllSelected(): boolean {
    return this.selection.selected.length === this.dataSource.data.length;
  }

  /** Sélectionne tous les éléments ou les désélectionne */
  toggleAllRows(): void {
    const allSelected = this.isAllSelected();

    this.selection.clear();  // Clear selection

    if (!allSelected) {
      this.selection.select(...this.dataSource.data);  // Select all GCPs
    }

    this.updateGcpLayerVisibility();
  }

  /** Sélectionne ou désélectionne un point GCP et met à jour la visibilité */
  toggleRow(row: GCP): void {
    this.selection.toggle(row);
    this.updateGcpLayerVisibility();
  }

  /** Met à jour la visibilité des couches de GCP */
  updateGcpLayerVisibility(): void {
    if (!this.imageLayers) return; // No GCP image layers

    this.imageLayers.forEach((layer, index) => {
      const isVisible = this.selection.selected.some(gcp => gcp.index === index);
      layer.setVisible(isVisible);
    });

    if (!this.mapLayers) return; // No GCP map layers

    this.mapLayers.forEach((layer, index) => {
      const isVisible = this.selection.selected.some(gcp => gcp.index === index);
      layer.setVisible(isVisible);
    });
  }

  deleteGcp(index: number): void {
    this.isDeleting = true;
    this.selection.deselect(this.dataSource.data.find(gcp => gcp.index === index)!);
    this.gcpService.deleteGcpData(index);
    this.imageService.deleteGcpLayer(index);
    this.mapService.deleteGcpLayer(index);
    this.updateGcpLayerVisibility();
    
    // Ajoute cette ligne pour réinitialiser après suppression
    setTimeout(() => { this.isDeleting = false; }, 100);
  }
  
  /** Commencer l'édition d'un GCP */
  editGcp(gcp: GCP): void {
    // Annuler toute édition en cours
    if (this.editingGcpId !== null) {
      this.cancelEdit();
    }
    
    // Définir le GCP en cours d'édition
    this.editingGcpId = gcp.index;
    
    // Remplir le formulaire avec les valeurs actuelles
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
    if (this.editForm.valid && this.editingGcpId !== null) {
      const updatedGcp = {
        ...this.dataSource.data.find(gcp => gcp.index === this.editingGcpId)!,
        sourceX: this.editForm.value.sourceX,
        sourceY: this.editForm.value.sourceY,
        mapX: this.editForm.value.mapX,
        mapY: this.editForm.value.mapY
      };
      
      // Mettre à jour le GCP dans le service
      this.gcpService.updateGcp(updatedGcp);
      
      // Mettre à jour les couches visuelles si nécessaire
      this.imageService.updateGcpPosition(this.editingGcpId, updatedGcp.sourceX, updatedGcp.sourceY);
      this.mapService.updateGcpPosition(this.editingGcpId, updatedGcp.mapX, updatedGcp.mapY);
      
      // Réinitialiser l'état d'édition
      this.editingGcpId = null;

      this.selection.select(updatedGcp);
    }
  }
  
  /** Annuler l'édition */
  cancelEdit(): void {
    this.editingGcpId = null;
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
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'cyan', 'magenta'];
    return colors[(index - 1) % colors.length]; // S'assurer de ne pas dépasser la liste
  }

  getTextColor(index: number): string {
    const textColors = ['white', 'white', 'white', 'black', 'white', 'black', 'black', 'white', 'black', 'white'];
    return textColors[(index - 1) % textColors.length];
  }

  openDeleteConfirmDialog(index: number): void {
      const dialogData: ConfirmDialogData = {
        title: 'Êtes-vous sûr de supprimer ce point de contrôle ?',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        icon: 'delete'
      };
  
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: dialogData
      });
  
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          console.log('Action confirmée');
          this.deleteGcp(index);
        } else {
          console.log('Action annulée');
        }
      });
    }
}