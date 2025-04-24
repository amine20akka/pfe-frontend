import { GeorefStatus } from "../enums/georef-status";
import { GeorefSettings } from "../interfaces/georef-settings";
import { WMSLayer } from "./wms-layer.model";

export interface GeorefImage {
  id: string;                      // ID unique pour le suivi
  imageFile: File;                 // Le fichier de l'image
  wmsLayer?: WMSLayer              // WMS Geoserver Layer  
  originalFilename: string;        // Nom du fichier original
  status: GeorefStatus;            // Statut du processus
  uploadingDate: Date              // Date d'importation de l'image
  lastGeoreferencingDate?: Date;   // Date du traitement
  settings: GeorefSettings;        // Paramètres de géoréférencement
  totalRMSE?: number;              // Valeur de résidue totale
}