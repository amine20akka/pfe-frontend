import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TransformationType, SRID, ResamplingMethod, CompressionType } from '../interfaces/georef-settings';

@Injectable({
  providedIn: 'root'
})
export class GeorefSettingsService {

  // Définition des paramètres avec un BehaviorSubject pour observer les changements
  private transformationTypeSubject = new BehaviorSubject<TransformationType>(TransformationType.POLYNOMIAL_1);
  private sridSubject = new BehaviorSubject<SRID>(SRID.WEB_MERCATOR);
  private resamplingMethodSubject = new BehaviorSubject<ResamplingMethod>(ResamplingMethod.NEAREST);
  private compressionTypeSubject = new BehaviorSubject<CompressionType>(CompressionType.NONE);
  private outputFilenameSubject = new BehaviorSubject<string>('');

  // Observables accessibles depuis toute l'application
  transformationType$ = this.transformationTypeSubject.asObservable();
  srid$ = this.sridSubject.asObservable();
  resamplingMethod$ = this.resamplingMethodSubject.asObservable();
  compressionType$ = this.compressionTypeSubject.asObservable();
  outputFilename$ = this.outputFilenameSubject.asObservable();

  // Méthodes pour modifier les valeurs et notifier les abonnés
  setTransformationType(value: TransformationType): void {
    this.transformationTypeSubject.next(value);
  }

  setSrid(value: SRID): void {
    this.sridSubject.next(value);
  }

  setResamplingMethod(value: ResamplingMethod): void {
    this.resamplingMethodSubject.next(value);
  }

  setCompression(value: CompressionType): void {
    this.compressionTypeSubject.next(value);
  }

  setOutputFilename(value: string): void {
    this.outputFilenameSubject.next(value);
  }

  // Méthode pour mettre à jour tous les paramètres en une seule fois
  updateSettings(settings: { 
    transformationType: TransformationType, 
    srid: SRID, 
    resamplingMethod: ResamplingMethod, 
    compressionType: CompressionType,
    outputFilename: string
  }): void {
    this.setTransformationType(settings.transformationType);
    this.setSrid(settings.srid);
    this.setResamplingMethod(settings.resamplingMethod);
    this.setCompression(settings.compressionType);
    this.setOutputFilename(settings.outputFilename);
  }
}