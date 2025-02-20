import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { GeorefService } from '../../services/georef.service';
import { ImageService } from '../../services/image.service';
import { GcpService } from '../../services/gcp.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatToolbarModule,
    MatDividerModule,
  ]
})
export class ToolbarComponent {

  constructor(
    private georefService: GeorefService, 
    private imageService: ImageService, 
    private gcpService: GcpService,
  ) { }

  // @Output() addGCP = new EventEmitter<void>();
  @Output() exportGCPs = new EventEmitter<void>();
  @Output() importGCPs = new EventEmitter<void>();
  // @Output() openSettings = new EventEmitter<void>();
  @Output() validateAndProcess = new EventEmitter<void>();
  // @Output() resetImage = new EventEmitter<void>();

  toggleGeoref() {
    this.georefService.toggleGeoref();
  }

  resetImage() {
    this.imageService.resetImage();
  }
  
  startAddingGcp() {
    this.gcpService.handleStartAddingGCP();
  }

  exportPoints() {
    this.exportGCPs.emit();
  }

  importPoints() {
    this.importGCPs.emit();
  }

  // openSettings() {
  //   this.openSettings.emit();
  // }

  startProcessing() {
    this.validateAndProcess.emit();
  }

  // resetImage() {
  //   this.resetImage.emit();
  // }
}
