export interface GeorefSettings {
    transformation_type: TransformationType;
    srid: SRID;
    resampling_method: ResamplingMethod;
    compression: CompressionType;
}

export enum TransformationType {
    POLYNOMIAL_1 = 'polynomial 1',
    POLYNOMIAL_2 = 'polynomial 2',
    POLYNOMIAL_3 = 'polynomial 3'
}

export enum SRID {
    WGS84 = 4326,
    WEB_MERCATOR = 3857
}

export enum ResamplingMethod {
    NEAREST = 'nearest',
    BILINEAR = 'bilinear',
    CUBIC = 'cubic',
    LANCZOS = 'lanczos'
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
    { value: SRID.WGS84, viewValue: 'WGS84 - EPSG:4326' },
    { value: SRID.WEB_MERCATOR, viewValue: 'Web Mercator - EPSG:3857' }
];