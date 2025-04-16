import { GCP } from "../models/gcp.model";
import { GeorefSettings } from "../interfaces/georef-settings";

export interface GeorefRequest {
    imageFile: File;
    gcps: GCP[];
    settings: GeorefSettings;
}