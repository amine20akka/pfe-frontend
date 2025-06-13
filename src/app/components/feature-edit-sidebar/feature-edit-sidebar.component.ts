/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import Feature from 'ol/Feature';
import { LayerSchema } from '../../interfaces/layer-schema';
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
import { Geometry } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import { FeatureUpdateRequest } from '../../dto/feature-update-request';
import { NotificationService } from '../../services/notification.service';
import { FeatureUpdateResult } from '../../dto/feature-update-result';
import { LayerService } from '../../services/layer.service';
import { labelize } from '../../mock-layers/utils';
import { DrawService } from '../../services/draw.service';
import { Style } from 'ol/style';

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
  defaultStyle!: Style;
  attributesForm: FormGroup;
  formFields: any[] = [];
  loading = false;
  layerSchema: LayerSchema | null = null;
  layerName = '';

  isNewFeature = false;
  editMode: 'edit' | 'add' = 'edit';

  constructor(
    private fb: FormBuilder,
    private drawApiService: DrawApiService,
    private notifService: NotificationService,
    private layerService: LayerService,
    private drawService: DrawService,
  ) {
    this.attributesForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.drawService.sidebarVisible$.subscribe((visible: boolean) => {
      this.isVisible = visible;
    });

    this.drawService.editFeature$.subscribe((feature: Feature | null) => {
      if (feature) {
        this.feature = feature;
        console.log("active feature : ", feature);

        this.isNewFeature = feature.getProperties()['isNew'] === true;
        this.editMode = this.isNewFeature ? 'add' : 'edit';

        if (!this.isNewFeature) {
          this.originalGeometry = feature.getGeometry()!.clone();
          this.originalProperties = { ...feature.getProperties() };
        }

        this.loadSchemaAndInitializeForm();
      }
    });
  }

  private loadSchemaAndInitializeForm(): void {
    this.loading = true;
    this.layerName = this.feature?.getProperties()['layerName'];

    this.drawApiService.getLayerSchema(this.feature?.getProperties()['layerId']).subscribe({
      next: (schema: LayerSchema) => {
        this.defaultStyle = this.feature?.getStyle() as Style;
        this.drawService.setSelectedFeatureStyle(this.feature!);
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
      let value = Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null;

      if (attribute.label === 'date_modif' || attribute.label === 'date_creation') {
        return;
      }

      const validators = [];

      if (this.isNewFeature && (value === null || value === undefined)) {
        value = this.getDefaultValue(attribute);
      }
      
      if (attribute.type === 'boolean') {
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
        value: value,
        options: attribute.options || []
      });
    });

    this.attributesForm = this.fb.group(formConfig);
  }

  /**
   * Obtenir la valeur par défaut selon le type d'attribut
   */
  private getDefaultValue(attribute: any): any {
    if (attribute.defaultValue !== undefined) {
      return attribute.defaultValue;
    }

    switch (attribute.type) {
      case 'boolean':
        return false;
      case 'number':
        return 0;
      case 'date':
        return null;
      case 'datetime-local':
        return null;
      default:
        return '';
    }
  }

  /**
   * Sauvegarder les modifications (nouvelles features ou existantes)
   */
  saveChanges(): void {
    if (this.attributesForm.invalid) {
      this.markFormGroupTouched(this.attributesForm);
      this.notifService.showError('Veuillez corriger les erreurs du formulaire');
      return;
    }

    if (this.isNewFeature) {
      this.saveNewFeature();
    } else {
      this.updateExistingFeature();
    }
  }

  private saveNewFeature(): void {
    if (!this.feature) return;

    const layerId = this.feature.getProperties()['layerId'];
    const currentGeometry = this.feature.getGeometry();

    if (!currentGeometry || !layerId) {
      this.notifService.showError('Données manquantes pour la sauvegarde');
      return;
    }

    const format = new GeoJSON();
    const geometryData = format.writeGeometry(currentGeometry);
    const formValues = this.attributesForm.value;

    const cleanedProperties = { ...formValues };

    const createRequest: FeatureUpdateRequest = {
      geometry: geometryData,
      properties: cleanedProperties,
    };

    this.loading = true;
    this.drawApiService.insertFeature(createRequest, layerId).subscribe({
      next: (createResult: FeatureUpdateResult) => {
        this.loading = false;
        if (createResult.success) {
          // Mettre à jour la feature avec l'ID retourné par le serveur
          if (createResult.featureId) {
            this.feature!.setId(createResult.featureId);
          }

          // Supprimer le marqueur temporaire
          this.feature!.unset('isNew');
          this.feature!.unset('tempId');

          this.notifService.showSuccess('Entité ajoutée avec succès');
          this.layerService.refreshLayerSourceById(layerId);
          this.drawService.finishNewFeatureEdit(this.feature!);
        } else {
          this.notifService.showError('Erreur lors de l\'ajout de l\'entité');
        }
      },
      error: (error: Error) => {
        this.loading = false;
        console.error('Erreur lors de la création:', error);
        this.notifService.showError('Erreur lors de l\'ajout de l\'entité');
      }
    });
  }

  private updateExistingFeature(): void {
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

    this.loading = true;
    this.drawApiService.updateFeature(updateRequest, featureId, layerId).subscribe({
      next: (featureUpdateResult: FeatureUpdateResult) => {
        this.loading = false;
        if (featureUpdateResult.success) {
          this.drawService.finishEditMode();
          this.drawService.restoreDefaultStyle(this.feature!, this.defaultStyle);
          this.layerService.refreshLayerSourceById(layerId);
          this.notifService.showSuccess('Modifications sauvegardées avec succès');
        } else {
          this.notifService.showError('Erreur lors de la sauvegarde');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Erreur lors de la mise à jour:', error);
        this.notifService.showError('Erreur lors de la sauvegarde des modifications');
      }
    });
  }

  /**
   * Marquer tous les champs du formulaire comme touchés pour afficher les erreurs
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Restaurer la géométrie (seulement pour les features existantes)
   */
  restoreGeometry(): void {
    if (this.isNewFeature) {
      this.notifService.showError('Impossible de restaurer la géométrie d\'une nouvelle entité');
      return;
    }

    if (this.feature && this.originalGeometry) {
      this.layerService.restoreFeatureGeometry(this.feature.getId(), this.originalGeometry, this.feature?.getProperties()['layerId']);
      this.notifService.showInfo('Géométrie restaurée');
    }
  }

  /**
   * Restaurer les propriétés (seulement pour les features existantes)
   */
  restoreProperties(): void {
    if (this.isNewFeature) {
      this.notifService.showError('Impossible de restaurer les propriétés d\'une nouvelle entité');
      return;
    }

    if (this.feature && this.originalProperties && this.layerSchema) {
      this.layerSchema.attributes.forEach(attribute => {
        const key = attribute.label;
        const originalValue = this.originalProperties[key];
        this.attributesForm.get(key)?.setValue(originalValue);
      });

      this.notifService.showInfo('Propriétés restaurées');
    }
  }

  /**
   * Restaurer tout (seulement pour les features existantes)
   */
  restoreAll(): void {
    if (this.isNewFeature) {
      // Pour les nouvelles features, on remet les valeurs par défaut
      this.initializeForm();
      this.notifService.showInfo('Formulaire réinitialisé');
      return;
    }

    this.restoreGeometry();
    this.restoreProperties();
    this.notifService.showInfo('Toutes les modifications sont annulées');
  }

  /**
   * Annuler l'édition
   */
  cancelEdit(): void {
    if (this.isNewFeature) {
      // Pour les nouvelles features, on les supprime de la carte
      this.restoreAll();
      this.drawService.finishNewFeatureEdit(this.feature!);
      this.notifService.showInfo("Ajout annulé");
    } else {
      // Pour les features existantes, on restaure l'état original
      this.restoreAll();
      this.drawService.finishEditMode();
      this.drawService.restoreDefaultStyle(this.feature!, this.defaultStyle);
    }
  }

  /**
   * Obtenir le titre du sidebar selon le mode
   */
  getSidebarTitle(): string {
    if (this.isNewFeature) {
      return `Ajouter une entité - ${this.layerName}`;
    }
    return `Modifier l'entité - ${this.layerName}`;
  }

  /**
   * Obtenir le texte du bouton de sauvegarde
   */
  getSaveButtonText(): string {
    return this.isNewFeature ? 'Ajouter' : 'Enregistrer';
  }
}
