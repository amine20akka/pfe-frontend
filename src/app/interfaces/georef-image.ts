import { GeorefSettings } from "./georef-settings";

export interface GeorefImage {
  id?: string;                     // ID unique pour le suivi
  imageFile: File;                 // Le fichier de l'image
  outputFile?: File;               // Le fichier de l'image géoréférencée
  filenameOriginal: string;        // Nom du fichier original
  filenameGeoreferenced?: string;  // Nom du fichier après géoréférencement
  originalFilePath?: string;       // Chemin de l'image originale (côté client)
  serverFilePath?: string;         // Chemin de stockage temporaire côté serveur
  resultFilePath?: string;         // Chemin du résultat géoréférencé
  status: GeorefStatus;            // Statut du processus
  lastGeoreferencingDate?: Date;   // Date du traitement
  settings: GeorefSettings;        // Paramètres de géoréférencement
}

export enum GeorefStatus {
  PENDING = 'pending',            // En attente de traitement
  UPLOADED = 'uploaded',        // Uploaded
  PROCESSING = 'processing',      // Traitement GDAL en cours
  COMPLETED = 'completed',        // Traitement réussi
  FAILED = 'failed',               // Échec du traitement
}