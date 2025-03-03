import { GCP } from "./gcp";
import { CompressionType, ResamplingMethod, SRID, TransformationType } from "./georef-settings";

export interface GeorefRequestData {
    transformationType: TransformationType,
    srid: SRID,
    resamplingMethod: ResamplingMethod,
    compressionType: CompressionType,
    outputFilename: string,
    gcps: GCP[],
}