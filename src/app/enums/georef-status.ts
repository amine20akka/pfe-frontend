export enum GeorefStatus {
    PENDING = 'pending',            // En attente de traitement
    UPLOADED = 'uploaded',          // Uploaded
    PROCESSING = 'processing',      // Traitement GDAL en cours
    COMPLETED = 'completed',        // Traitement réussi
    FAILED = 'failed',              // Échec du traitement
  }