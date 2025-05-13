import { GeorefStatus } from "../enums/georef-status";
import { GeorefSettings } from "../interfaces/georef-settings";

export interface GeorefImage {
  id: string;
  imageFile: File;
  originalFilename: string;
  status: GeorefStatus;
  uploadingDate: Date;
  lastGeoreferencingDate?: Date;
  settings: GeorefSettings;
  totalRMSE?: number;
}