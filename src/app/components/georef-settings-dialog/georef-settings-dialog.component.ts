import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { COMPRESSION_TYPES, GeorefSettings, RESAMPLING_METHODS, SRID_OPTIONS, SRIDS, TRANSFORMATION_TYPES } from '../../interfaces/georef-settings';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
  ],
  templateUrl: './georef-settings-dialog.component.html',
  styleUrl: './georef-settings-dialog.component.scss'
})
export class GeorefSettingsDialogComponent {
  transformationTypes = TRANSFORMATION_TYPES;
  srids = SRIDS;
  sridOptions = SRID_OPTIONS;
  resamplingMethods = RESAMPLING_METHODS;
  compressionTypes = COMPRESSION_TYPES;
  
  georefForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<GeorefSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GeorefSettings
  ) {
    this.georefForm = this.fb.group({
      transformation_type: [data.transformation_type, Validators.required],
      srid: [data.srid, Validators.required],
      resampling_method: [data.resampling_method, Validators.required],
      compression: [data.compression, Validators.required],
      output_filename: [data.output_filename, [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.georefForm.valid) {
      this.dialogRef.close(this.georefForm.value);
    } else {
      this.georefForm.markAllAsTouched(); // Afficher les erreurs si le form est invalide
    }
  }
}
