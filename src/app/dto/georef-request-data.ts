import { GCP } from "../models/gcp";
import { GeorefSettings } from "../models/georef-settings";

export interface GeorefRequestData {
    imageFile: File;
    gcps: GCP[];
    settings: GeorefSettings;
}