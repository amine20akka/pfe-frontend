import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GeorefSettings } from '../interfaces/georef-settings';
import { CompressionType } from '../enums/compression-type';
import { ResamplingMethod } from '../enums/resampling-method';
import { SRID } from '../enums/srid';
import { TransformationType } from '../enums/transformation-type';

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
    outputFilename: '.tif'
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

  resetSettings(): void {
    this.settingsSubject.next({
      transformationType: TransformationType.POLYNOMIAL_1,
      srid: SRID.WEB_MERCATOR,
      resamplingMethod: ResamplingMethod.NEAREST,
      compressionType: CompressionType.NONE,
      outputFilename: '.tif'
    });
  }
}