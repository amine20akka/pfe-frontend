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
    NEAREST = 'Plus proche voisin',
    BILINEAR = 'Bilinear',
    CUBIC = 'Cubic',
    LANCZOS = 'Lanczos'
}

export enum CompressionType {
    NONE = 'NONE',
    LZW = 'LZW',
    JPEG = 'JPEG',
    DEFLATE = 'DEFLATE'
}

// Vous pouvez également créer des tableaux à partir des enums pour les utiliser dans les listes déroulantes
export const TRANSFORMATION_TYPES = Object.values(TransformationType);
export const SRIDS = Object.values(SRID);
export const RESAMPLING_METHODS = Object.values(ResamplingMethod);
export const COMPRESSION_TYPES = Object.values(CompressionType);

// Pour les SRIDS, vous pourriez vouloir un objet clé-valeur pour afficher des descriptions
export const SRID_OPTIONS = [
    { value: SRID.WGS84, viewValue: 'EPSG:4326 - WGS84' },
    { value: SRID.WEB_MERCATOR, viewValue: 'EPSG:3857 - WGS84 / Pseudo-Mercator' }
];