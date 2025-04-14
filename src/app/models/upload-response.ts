import { GeorefStatus } from "./georef-image";

export interface UploadResponse {
    id: string;
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