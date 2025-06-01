/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { DrawApiService } from '../../services/draw-api.service';
import { LayerSchema } from '../../dto/layer-schema';
import Feature from 'ol/Feature';
import { labelize } from '../../mock-layers/utils';

@Component({
  selector: 'app-feature-actions-dialog',
  imports: [
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    CommonModule,
    MatDividerModule,
  ],
  templateUrl: './feature-actions-dialog.component.html',
  styleUrl: './feature-actions-dialog.component.scss'
})
export class FeatureActionsDialogComponent implements OnInit {
  
  propertyKeys: string[] = [];
  propertyValues: any[] = [];
  layerName: string | null = null;
  feature: Feature;

  constructor(
    private drawApiService: DrawApiService,
    @Inject(MAT_DIALOG_DATA) public data: { feature: Feature },
  ) {
    this.feature = data.feature;
  }

  ngOnInit(): void {
    this.initializeProperties();
  }

  private initializeProperties(): void {
    const props = this.feature.getProperties();
    this.layerName = props['layerName'] || null;
    
    this.propertyValues = Object.entries(props)
      .filter(([key]) => key !== 'geometry' && key !== 'layerId' && key !== 'layerName')
      .map(([, value]) => value);
    
    const layerId = props['layerId'];
    if (layerId) {
      this.setPropertyKeys(layerId);
    }
  }

  setPropertyKeys(layerId: string): void {
    this.drawApiService.getLayerSchema(layerId).subscribe({
      next: (layerSchema: LayerSchema) => {
        if (layerSchema.attributes) {
          const keys = layerSchema.attributes.map(attr => attr.label);
          this.propertyKeys = keys.map(label => labelize(label));
        }
      }
    });
  }
}
