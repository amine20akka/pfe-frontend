import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GcpService } from '../../services/gcp.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImageService } from '../../services/image.service';
import { MapService } from '../../services/map.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gcp-dialog',
  templateUrl: './gcp-dialog.component.html',
  styleUrls: ['./gcp-dialog.component.scss'],
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatLabel,
    MatInputModule,
    CommonModule,
  ]
})
export class GcpDialogComponent implements OnInit {
  gcpForm!: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<GcpDialogComponent>,
    private fb: FormBuilder, // FormBuilder pour initialiser le FormGroup
    private gcpService: GcpService,
    private imageService: ImageService,
    private mapService: MapService,
    @Inject(MAT_DIALOG_DATA) public data: { x: number, y: number }
  ) { }

  ngOnInit() {
    // Initialisation du formulaire avec valeurs et validations
    this.gcpForm = this.fb.group({
      mapX: [this.data ? parseFloat(this.data.x.toFixed(4)) : '', [Validators.required, 
        Validators.pattern(/^-?\d+(\.\d+)?$/)]],
      mapY: [this.data ? parseFloat(this.data.y.toFixed(4)) : '', [Validators.required, 
        Validators.pattern(/^-?\d+(\.\d+)?$/)]]
    });
  }

  onConfirm() {
    if (this.gcpForm.valid) {
      this.dialogRef.close(this.gcpForm.value);
    }
  }

  startMapSelection() {
    this.mapService.startMapSelection();
    this.dialogRef.close(); // Fermer le dialogue pour permettre l'interaction avec la carte
  }  

  onCancel() {
    const deletedIndex = this.imageService.deleteLastGcpLayer();
    this.mapService.deleteLastGcpLayer(deletedIndex);
    this.gcpService.isAddingGCP = false;
    this.dialogRef.close();
  }
}
