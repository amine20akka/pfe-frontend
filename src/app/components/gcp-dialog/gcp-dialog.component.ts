import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GcpService } from '../../services/gcp.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ImageService } from '../../services/image.service';
import { MapService } from '../../services/map.service';

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
    FormsModule,
    MatLabel,
    MatInputModule,
  ]
})
export class GcpDialogComponent implements OnInit {
  mapX!: number;
  mapY!: number;

  constructor(
    private dialogRef: MatDialogRef<GcpDialogComponent>,
    private gcpService: GcpService,
    private imageService: ImageService,
    private mapService: MapService,
    @Inject(MAT_DIALOG_DATA) public data: { x: number, y: number }
  ) { }

  ngOnInit() {
    if (this.data) {
      this.mapX = parseFloat(this.data.x.toFixed(4));
      this.mapY = parseFloat(this.data.y.toFixed(4));
    }
  }

  onConfirm() {
    // Fermer le dialogue avec les coordonnées destination (map)
    this.dialogRef.close({
      mapX: this.mapX,
      mapY: this.mapY
    });
  }

  startMapSelection() {
    this.mapService.startMapSelection();
    this.dialogRef.close(); // Close dialog to allow map interaction
  }  

  onCancel() {
    const deletedIndex = this.imageService.deleteLastGcpLayer();
    this.mapService.deleteLastGcpLayer(deletedIndex);
    this.gcpService.isAddingGCP = false;
    this.dialogRef.close();
  }
}
