import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GeorefImage } from '../../models/georef-image.model';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-layer-details',
  imports: [
    MatDividerModule,
    MatButtonModule,
  ],
  templateUrl: './layer-details.component.html',
  styleUrl: './layer-details.component.scss'
})
export class LayerDetailsComponent {
  geoImage: GeorefImage;
  
  constructor(
    public dialogRef: MatDialogRef<LayerDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { geoImage: GeorefImage }
  ) {
    this.geoImage = data.geoImage;
  }

  formatDate(date: Date | string): string {
    if (!date) return 'Non disponible';
    
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
