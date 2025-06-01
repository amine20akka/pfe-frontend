/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import Feature from 'ol/Feature';
import { LayerSchema } from '../../dto/layer-schema';
import { DrawApiService } from '../../services/draw-api.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { MapService } from '../../services/map.service';
import { Geometry } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import { FeatureUpdateRequest } from '../../dto/feature-update-request';
import { NotificationService } from '../../services/notification.service';
import { FeatureUpdateResult } from '../../dto/feature-update-result';
import { LayerService } from '../../services/layer.service';
import { labelize } from '../../mock-layers/utils';

@Component({
  selector: 'app-feature-edit-sidebar',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatLabel,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatSelectModule,
    MatInputModule,
    CommonModule,
  ],
  templateUrl: './feature-edit-sidebar.component.html',
  styleUrl: './feature-edit-sidebar.component.scss'
})
export class FeatureEditSidebarComponent implements OnInit {

  isVisible = false;
  feature: Feature | null = null;
  originalGeometry!: Geometry;
  originalProperties: any = {};
  attributesForm: FormGroup;
  formFields: any[] = [];
  loading = false;
  layerSchema: LayerSchema | null = null;
  layerName = '';

  constructor(
    private fb: FormBuilder,
    private drawApiService: DrawApiService,
    private mapService: MapService,
    private notifService: NotificationService,
    private layerService: LayerService
  ) {
    this.attributesForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.mapService.sidebarVisible$.subscribe((visible: boolean) => {
      this.isVisible = visible;
    });

    this.mapService.editFeature$.subscribe((feature: Feature | null) => {
      if (feature) {
        this.feature = feature;
        this.originalGeometry = feature.getGeometry()!.clone();
        this.originalProperties = { ...feature.getProperties() };
        this.loadSchemaAndInitializeForm();
      }
    });
  }

  private loadSchemaAndInitializeForm(): void {
    this.loading = true;
    this.layerName = this.feature?.getProperties()['layerName'];

    this.drawApiService.getLayerSchema(this.feature?.getProperties()['layerId']).subscribe({
      next: (schema: LayerSchema) => {
        this.layerSchema = schema;
        this.initializeForm();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement du schéma de la couche:', error);
        this.notifService.showError('Erreur lors du chargement du formulaire');
        this.loading = false;
      }
    });
  }

  private initializeForm(): void {
    if (!this.feature || !this.layerSchema) return;

    const properties = this.feature.getProperties();
    const formConfig: any = {};
    this.formFields = [];

    this.layerSchema.attributes.forEach(attribute => {
      const key = attribute.label;
      let value = properties[key] || null;

      const validators = [];

      if (attribute.type === 'datetime-local' && value) {
        value = this.formatDateTimeLocal(value);
      } else if (attribute.type === 'date' && value) {
        // Pour les champs date simples, convertir aussi
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
        }
      } else if (attribute.type === 'boolean') {
        value = value === 'true' || value === true;
      }

      if (attribute.type === 'number') {
        validators.push(Validators.pattern(/^-?\d*\.?\d*$/));
      }

      formConfig[key] = [value, validators];

      this.formFields.push({
        name: key,
        label: labelize(attribute.label),
        type: attribute.type,
        value: value
      });
    });

    this.attributesForm = this.fb.group(formConfig);
  }

  /**
 * Convertit une date ISO (avec timezone) vers le format datetime-local.
 * Exemple: "2021-04-23T14:01:47Z" -> "2021-04-23T14:01"
 */
  private formatDateTimeLocal(dateValue: string | Date | null): string {
    if (!dateValue) return '';

    try {
      let date: Date;

      if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      } else {
        date = dateValue;
      }

      // Vérifier si la date est valide
      if (isNaN(date.getTime())) {
        console.warn('Date invalide:', dateValue);
        return '';
      }

      // Convertir en time local et formater pour datetime-local
      // Format requis: YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      // Inclure les secondes si elles ne sont pas à 00
      if (seconds !== '00') {
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      }

      return `${year}-${month}-${day}T${hours}:${minutes}`;

    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error, dateValue);
      return '';
    }
  }

  saveChanges(): void {
    const featureId = this.feature?.getId();
    const layerId = this.feature?.getProperties()['layerId'];

    if (!featureId || !layerId) {
      console.error('ID du feature ou de la couche manquant');
      this.notifService.showError('ID du feature ou de la couche manquant');
      return;
    }

    const currentGeometry = this.feature?.getGeometry();
    if (!currentGeometry) {
      console.error('Géométrie manquante');
      this.notifService.showError('Géométrie manquante');
      return;
    }

    const format = new GeoJSON();
    const geometryData = format.writeGeometry(currentGeometry);

    const formValues = this.attributesForm.value;
    const cleanedProperties = { ...formValues };

    const updateRequest: FeatureUpdateRequest = {
      geometry: geometryData,
      properties: cleanedProperties,
    };

    console.log('Envoi de la requête de mise à jour:', updateRequest.properties);

    this.drawApiService.updateFeature(updateRequest, featureId, layerId).subscribe({
      next: (featureUpdateResult: FeatureUpdateResult) => {
        if (featureUpdateResult.success) {
          this.mapService.finishEditMode();
          this.layerService.refreshLayerSourceById(layerId);
          this.notifService.showInfo('Modifications sauvegardées avec succès');
        } else {
          this.notifService.showError('Erreur lors de la sauvegarde');
        }
      },
      error: () => {
        this.notifService.showError('Erreur lors de la sauvegarde des modifications');
      }
    });
  }

  restoreGeometry(): void {
    if (this.feature && this.originalGeometry) {
      this.mapService.restoreFeatureGeometry(this.feature.getId(), this.originalGeometry);

      this.notifService.showInfo('Géométrie restaurée');
    }
  }

  restoreProperties(): void {
    if (this.feature && this.originalProperties && this.layerSchema) {
      this.layerSchema.attributes.forEach(attribute => {
        const key = attribute.label;
        let originalValue = this.originalProperties[key];

        // Appliquer le même traitement qu'à l'initialisation
        if (attribute.type === 'datetime-local' && originalValue) {
          originalValue = this.formatDateTimeLocal(originalValue);
        } else if (attribute.type === 'date' && originalValue) {
          const date = new Date(originalValue);
          if (!isNaN(date.getTime())) {
            originalValue = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          } else {
            console.warn('Date invalide lors de la restauration:', originalValue);
          }
        }

        this.attributesForm.get(key)?.setValue(originalValue);
      });

      this.notifService.showInfo('Propriétés restaurées');
    }
  }


  restoreAll(): void {
    this.restoreGeometry();
    this.restoreProperties();

    this.notifService.showInfo('Toutes les modifications sont annulées');
  }

  cancelEdit(): void {
    this.restoreAll();
    this.mapService.finishEditMode();
  }
}
