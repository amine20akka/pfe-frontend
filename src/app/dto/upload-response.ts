import { GeorefStatus } from "../enums/georef-status";

export interface UploadResponse {
    id: string;
    filepathOriginal: string;
    uploadingDate: string;
    status: GeorefStatus;
}