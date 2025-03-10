import { GeorefSettings } from "./georef-settings";
import { WMSLayer } from "./wms-layer";

export interface GeorefImage {
  id?: string;                     // ID unique pour le suivi
  imageFile: File;                 // Le fichier de l'image
  wmsLayer?: WMSLayer              // WMS Geoserver Layer  
  filenameOriginal: string;        // Nom du fichier original
  originalFilePath?: string;       // Chemin de l'image originale (côté client)
  status: GeorefStatus;            // Statut du processus
  uploadingDate: Date              // Date d'importation de l'image
  lastGeoreferencingDate?: Date;   // Date du traitement
  settings: GeorefSettings;        // Paramètres de géoréférencement
  totalRMSE?: number;              // Valeur de résidue totale
}

export enum GeorefStatus {
  PENDING = 'pending',            // En attente de traitement
  UPLOADED = 'uploaded',          // Uploaded
  PROCESSING = 'processing',      // Traitement GDAL en cours
  COMPLETED = 'completed',        // Traitement réussi
  FAILED = 'failed',              // Échec du traitement
}