import { GeorefSettings } from "./georef-settings";

export interface GeorefImage {
    // id?: number;
    filenameOriginal: string;
    filenameGeoreferenced?: string;
    filePath?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    lastGeoreferencingDate?: Date;
    settings: GeorefSettings
    // gcpsCount?: number;
    // meanResidual?: number;
    // processingTime?: string;
    // errorMessage?: string;
  }
  