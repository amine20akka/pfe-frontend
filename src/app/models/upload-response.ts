import { GeorefStatus } from "./georef-image";

export interface UploadResponse {
    id: number;
    filepathOriginal: string;
    uploadingDate: string;
    status: GeorefStatus;
    filepathGeoreferenced?: unknown;
    lastGeoreferencingDate?: unknown;
    transformationType?: unknown;
    srid?: unknown;
    resamplingMethod?: unknown;
    compression?: unknown;
    meanResidual?: unknown;
    gcps?: unknown;
    layer?: unknown;
}