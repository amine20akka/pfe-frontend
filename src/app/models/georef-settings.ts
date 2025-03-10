export interface GeorefSettings {
    transformationType: TransformationType;
    srid: SRID;
    resamplingMethod: ResamplingMethod;
    compressionType: CompressionType;
    outputFilename: string;
}

export enum TransformationType {
    POLYNOMIAL_1 = 'Polynomiale 1',
    POLYNOMIAL_2 = 'Polynomiale 2',
    POLYNOMIAL_3 = 'Polynomiale 3'
}

export enum SRID {
    WGS84 = 4326,
    WEB_MERCATOR = 3857
}

export enum ResamplingMethod {
    NEAREST = 'Nearest',
    BILINEAR = 'Bilinear',
    CUBIC = 'Cubic',
}

export enum CompressionType {
    NONE = 'NONE',
    LZW = 'LZW',
    JPEG = 'JPEG',
    DEFLATE = 'DEFLATE'
}

// Vous pouvez également créer des tableaux à partir des enums pour les utiliser dans les listes déroulantes
export const TRANSFORMATION_TYPES = Object.values(TransformationType);
export const SRIDS = Object.values(SRID).filter(value => typeof value === 'number');
export const RESAMPLING_METHODS = Object.values(ResamplingMethod);
export const COMPRESSION_TYPES = Object.values(CompressionType);