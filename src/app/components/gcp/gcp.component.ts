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

@Component({
  selector: 'app-gcp',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    CommonModule,
    MatCheckboxModule,
    MatTooltipModule,
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
  ) { }
  
  displayedColumns: string[] = ['select', 'index', 'sourceX', 'sourceY', 'mapX', 'mapY', 'residual', 'edit', 'delete'];
  dataSource = new MatTableDataSource<GCP>();
  selection = new SelectionModel<GCP>(true, []);
  isDeleting = false;
  private gcpLayers: Map<number, VectorLayer<VectorSource>> = new Map<number, VectorLayer<VectorSource>>();
  
  ngOnInit() {
    this.gcpService.gcps$.subscribe((gcps) => {
      this.dataSource.data = gcps;
      // Sélectionner automatiquement les nouveaux GCPs et les rendre visibles
      if (gcps.length > 0 && !this.isDeleting) {
        this.selection.select(gcps[gcps.length - 1]);
        this.isDeleting = false;
      }
      // Update residual values
      if (gcps.length >= 3) {
        this.gcpService.updateGcpsAndResiduals();
      } else {
        this.dataSource.data.forEach((gcp) => {
          gcp.residual = undefined;
        })
      }
      this.updateGcpLayerVisibility();
      console.log('GCPs Data : ', gcps);
      console.log('GCPs Selection : ', this.selection);
    });
    this.imageService.imageLayers$.subscribe((imageLayers) => {
      this.gcpLayers = imageLayers;
      console.log('GCPs Layers : ', imageLayers);
    });
  }

  ngOnDestroy(): void {
    this.gcpService.isAddingGCP = false;
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
    if (!this.gcpLayers) return; // No GCP layers

    this.gcpLayers.forEach((layer, index) => {
      const isVisible = this.selection.selected.some(gcp => gcp.index === index);
      layer.setVisible(isVisible);
    });
  }

  deleteGcp(index: number): void {
    const deletedGcp = this.gcpService.getGCPs()[index - 1];
    console.log(deletedGcp);
    this.isDeleting = true;
    this.selection.deselect(this.dataSource.data.find(gcp => gcp.index === index)!);
    this.gcpService.deleteGcpData(index);
    this.imageService.deleteGcpLayer(index);
    this.updateGcpLayerVisibility();
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

}
