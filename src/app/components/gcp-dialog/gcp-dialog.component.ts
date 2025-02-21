import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GcpService } from '../../services/gcp.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

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
export class GcpDialogComponent {
  selection: 'click' | 'manual' = 'click';
  x!: number;
  y!: number;

  constructor(
    private dialogRef: MatDialogRef<GcpDialogComponent>,
    private gcpService: GcpService
  ) {}

  onConfirm() {
    if (this.selection === 'manual' && this.x !== undefined && this.y !== undefined) {
      this.gcpService.addGCP(this.x, this.y);
    } else if (this.selection === 'click') {
      // this.gcpService.handleStartAddingGCP();
    }
    this.gcpService.isAddingGCP = false;
    this.dialogRef.close();
  }

  onCancel() {
    this.gcpService.isAddingGCP = false;
    this.dialogRef.close();
  }
}
