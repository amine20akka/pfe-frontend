import { GCP } from "../models/gcp.model";
import { GeorefSettings } from "../interfaces/georef-settings";

export interface GeorefRequest {
    gcps: GCP[];
    georefSettings: GeorefSettings;
}