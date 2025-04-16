import { CompressionType } from "../enums/compression-type";
import { GeorefStatus } from "../enums/georef-status";
import { ResamplingMethod } from "../enums/resampling-method";
import { SRID } from "../enums/srid";
import { TransformationType } from "../enums/transformation-type";

export interface GeorefImageDto {
  id: string;
  hash: string;
  filepathOriginal: string;
  filepathGeoreferenced: string;
  uploadingDate: string;
  lastGeoreferencingDate: string;
  transformationType: TransformationType;
  srid: SRID;
  status: GeorefStatus;
  resamplingMethod: ResamplingMethod;
  compression: CompressionType;
  meanResidual: number;
}