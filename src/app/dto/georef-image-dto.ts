import { CompressionType } from "../enums/compression-type";
import { GeorefStatus } from "../enums/georef-status";
import { ResamplingMethod } from "../enums/resampling-method";
import { SRID } from "../enums/srid";
import { TransformationType } from "../enums/transformation-type";
import { GeorefImage } from "../models/georef-image.model";

export interface GeorefImageDto {
  id: string;
  filepathOriginal: string;
  outputFilename: string;
  uploadingDate: string;
  lastGeoreferencingDate: string;
  transformationType: TransformationType;
  srid: SRID;
  status: GeorefStatus;
  resamplingMethod: ResamplingMethod;
  compression: CompressionType;
  meanResidual: number;
}

export function ToDto(georefImage: GeorefImage): GeorefImageDto {
  return {
    id: georefImage.id,
    filepathOriginal: georefImage.originalFilename,
    uploadingDate: georefImage.uploadingDate.toISOString(),
    lastGeoreferencingDate: georefImage.lastGeoreferencingDate!.toISOString(),
    status: georefImage.status,
    transformationType: georefImage.settings.transformationType!,
    srid: georefImage.settings.srid!,
    resamplingMethod: georefImage.settings.resamplingMethod!,
    compression: georefImage.settings.compressionType!,
    outputFilename: georefImage.settings.outputFilename!,
    meanResidual: georefImage.totalRMSE!,
  };
}