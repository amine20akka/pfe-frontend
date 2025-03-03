import { GeorefSettings } from "./georef-settings";

export interface GeorefImage {
  // id?: number;
  filenameOriginal: string;
  filenameGeoreferenced?: string;
  filePath?: string;
  status?: GeorefStatus;
  lastGeoreferencingDate?: Date;
  settings: GeorefSettings
  // gcpsCount?: number;
  // meanResidual?: number;
  // processingTime?: string;
  // errorMessage?: string;
}

export enum GeorefStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}