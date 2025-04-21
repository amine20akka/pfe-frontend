import { Injectable } from '@angular/core';
import { NotificationService } from './notification.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImageFileService {

  private objectUrl: string | null = null;
  private file: File | null = null;
  private extent: number[] = [];
  private imageWidth = 0;
  private imageHeight = 0;
  cursorCoordinates = new BehaviorSubject<{ x: number; y: number }>({ x: 0, y: 0 });

  constructor(
    private notifService: NotificationService,
  ) { }

  setImageFile(file: File): string {
    this.clear();
    this.file = file;
    this.objectUrl = URL.createObjectURL(file);
    return this.objectUrl;
  }

  getImageUrl(): string | null {
    return this.objectUrl;
  }

  getImageFile(): File | null {
    return this.file;
  }

  clear(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.file = null;
  }

  getCurrentExtent(): number[] {
    return this.extent;
  }

  setNewExtent(newExtent: number[]): void {
    this.extent = newExtent;
  }

  getImageWidth(): number {
    return this.imageWidth;
  }

  getImageHeight(): number {
    return this.imageHeight;
  }

  setImageWidth(width: number): void {
    this.imageWidth = width;
  }

  setImageHeight(height: number): void {
    this.imageHeight = height;
  }

  setImageDimensions(width: number, height: number): void {
    this.imageWidth = width;
    this.imageHeight = height;
  }

  validateFile(file: File): boolean {
    const MAX_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.notifService.showError("Format d'image non supporté");
      return false;
    }

    if (file.size > MAX_SIZE) {
      this.notifService.showError('Fichier trop volumineux (max 10 Mo)');
      return false;
    }

    return true;
  }

  base64ToFile(base64: string, filename: string): File {
    const byteString = atob(base64);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    return new File([byteArray], filename);
  }

}
