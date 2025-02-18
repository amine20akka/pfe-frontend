import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ImageService } from '../../services/image.service';

@Component({
  selector: 'app-upload',
  imports: [ 
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent {
  
  constructor(private imageService: ImageService) { }

  get isImageLoaded() {
    return this.imageService.isImageLoaded;
  }

  get imageUrl() {
    return this.imageService.imageUrl;
  }

  get isDragging() {
    return this.imageService.isDragging;
  }

  onDragOver(event: DragEvent) {
    this.imageService.onDragOver(event);
  }

  onDragLeave(event: DragEvent) {
    this.imageService.onDragLeave(event);
  }

  onDrop(event: DragEvent) {
    this.imageService.onDrop(event);
  }

  onFileSelected(event: Event) {
    this.imageService.onFileSelected(event);
  }

}
