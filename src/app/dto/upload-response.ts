import { CompressionType } from "../enums/compression-type";
import { GeorefStatus } from "../enums/georef-status";
import { ResamplingMethod } from "../enums/resampling-method";
import { SRID } from "../enums/srid";
import { TransformationType } from "../enums/transformation-type";

export interface UploadResponse {
    id: string;
    filepathOriginal: string;
    uploadingDate: string;
    status: GeorefStatus;
    transformationType?: TransformationType;
    srid?: SRID;
    resamplingMethod?: ResamplingMethod;
    compressionType?: CompressionType;
    outputFilename?: string;
}