import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { COMPRESSION_TYPES, GeorefSettings, RESAMPLING_METHODS, SRIDS, TRANSFORMATION_TYPES } from '../../interfaces/georef-settings';
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
  resamplingMethods = RESAMPLING_METHODS;
  compressionTypes = COMPRESSION_TYPES;
  
  georefForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<GeorefSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GeorefSettings
  ) {
    this.georefForm = this.fb.group({
      transformationType: [data.transformationType, Validators.required],
      srid: [data.srid, Validators.required],
      resamplingMethod: [data.resamplingMethod, Validators.required],
      compressionType: [data.compressionType, Validators.required],
      outputFilename: [data.outputFilename, [Validators.required, Validators.pattern(/^[a-zA-Z0-9_.-]+$/)]],
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.georefForm.valid) {
      this.dialogRef.close(this.georefForm.value);
    } else {
      this.georefForm.markAllAsTouched();
    }
  }
}
