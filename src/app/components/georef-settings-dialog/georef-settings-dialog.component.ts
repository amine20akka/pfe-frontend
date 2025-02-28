import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { COMPRESSION_TYPES, GeorefSettings, RESAMPLING_METHODS, SRID_OPTIONS, SRIDS, TRANSFORMATION_TYPES } from '../../interfaces/georef-settings';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-georef-settings-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
  ],
  templateUrl: './georef-settings-dialog.component.html',
  styleUrl: './georef-settings-dialog.component.scss'
})
export class GeorefSettingsDialogComponent {
  // Utiliser les tableaux exportés des valeurs d'enum
  transformationTypes = TRANSFORMATION_TYPES;
  srids = SRIDS;
  sridOptions = SRID_OPTIONS; // Pour afficher des descriptions dans le sélecteur
  resamplingMethods = RESAMPLING_METHODS;
  compressionTypes = COMPRESSION_TYPES;
  
  settings: GeorefSettings;

  constructor(
    public dialogRef: MatDialogRef<GeorefSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GeorefSettings
  ) {
    this.settings = {...data};
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.settings);
  }
}
