export interface GeoTiffMetadata {
    success: boolean;
    metadata?: {
      projection: {
        wkt: string;
        epsgCode: string | null;
      };
      extent: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      };
      resolution: {
        pixelWidth: number;
        pixelHeight: number;
      };
      imageInfo: {
        width: number;
        height: number;
        bandCount: number;
      };
    };
    error?: string;
  }