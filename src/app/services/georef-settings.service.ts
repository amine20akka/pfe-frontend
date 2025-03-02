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
  private outputFilenameSubject = new BehaviorSubject<string>('output_georef.tif');

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
    transformation_type: TransformationType, 
    srid: SRID, 
    resampling_method: ResamplingMethod, 
    compression: CompressionType,
    output_filename: string
  }): void {
    this.setTransformationType(settings.transformation_type);
    this.setSrid(settings.srid);
    this.setResamplingMethod(settings.resampling_method);
    this.setCompression(settings.compression);
    this.setOutputFilename(settings.output_filename);
  }
}