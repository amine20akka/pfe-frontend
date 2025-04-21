import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeorefSettingsService {

  normalizeOutputFilename(name: string | null | undefined, fallbackBaseName: string): string {
    if (!name || name.trim() === '') {
      return `${fallbackBaseName.replace(/\./g, '')}_georef.tif`;
    }
  
    // Supprimer tous les points sauf celui de l'extension .tif
    const nameWithoutExtension = name.split('.').slice(0, -1).join('.') || name;
    const cleanedName = nameWithoutExtension.replace(/\./g, '');
  
    return `${cleanedName}.tif`;
  }
  
}