import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TransformationType, SRID, ResamplingMethod, CompressionType } from '../models/georef-settings';
import { GeorefSettings } from '../models/georef-settings';

@Injectable({
  providedIn: 'root'
})
export class GeorefSettingsService {

  // Définition des paramètres avec un BehaviorSubject pour observer les changements
  private settingsSubject = new BehaviorSubject<GeorefSettings>({
    transformationType: TransformationType.POLYNOMIAL_1,
    srid: SRID.WEB_MERCATOR,
    resamplingMethod: ResamplingMethod.NEAREST,
    compressionType: CompressionType.NONE,
    outputFilename: ''
  });

  // Observable accessible depuis toute l'application
  settings$ = this.settingsSubject.asObservable();

  // Méthode pour mettre à jour tous les paramètres en une seule fois
  updateSettings(settings: GeorefSettings): void {
    const extensionIndex = settings.outputFilename.indexOf('.');
    if (extensionIndex === -1) {
      settings.outputFilename = settings.outputFilename.concat('.tif');
    } else {
      settings.outputFilename = settings.outputFilename.substring(0, extensionIndex).concat('.tif');
    }
    this.settingsSubject.next(settings);
  }
}