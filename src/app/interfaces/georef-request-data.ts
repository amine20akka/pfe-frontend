import { GCP } from "./gcp";
import { GeorefSettings } from "./georef-settings";

export interface GeorefRequestData {
    imageFile: File;
    gcps: GCP[];
    settings: GeorefSettings;
}