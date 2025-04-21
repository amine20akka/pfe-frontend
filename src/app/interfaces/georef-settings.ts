import { CompressionType } from "../enums/compression-type";
import { ResamplingMethod } from "../enums/resampling-method";
import { SRID } from "../enums/srid";
import { TransformationType } from "../enums/transformation-type";

export interface GeorefSettings {
    transformationType?: TransformationType;
    srid?: SRID;
    resamplingMethod?: ResamplingMethod;
    compressionType?: CompressionType;
    outputFilename?: string;
}

// Tableaux à partir des enums pour les utiliser dans les listes déroulantes
export const TRANSFORMATION_TYPES = Object.values(TransformationType);
export const SRIDS = Object.values(SRID).filter(value => typeof value === 'number');
export const RESAMPLING_METHODS = Object.values(ResamplingMethod);
export const COMPRESSION_TYPES = Object.values(CompressionType);