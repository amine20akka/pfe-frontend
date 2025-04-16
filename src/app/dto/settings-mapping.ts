import { CompressionType } from "../enums/compression-type";
import { ResamplingMethod } from "../enums/resampling-method";
import { SRID } from "../enums/srid";
import { TransformationType } from "../enums/transformation-type";

export const TransformationMapping = {
  [TransformationType.POLYNOMIAL_1]: 'POLYNOMIALE_1',
  [TransformationType.POLYNOMIAL_2]: 'POLYNOMIALE_2',
  [TransformationType.POLYNOMIAL_3]: 'POLYNOMIALE_3'
};

export const SridMapping = {
  [SRID.WGS84]: '_4326',
  [SRID.WEB_MERCATOR]: '_3857'
};

export const ResamplingMapping = {
  [ResamplingMethod.NEAREST]: 'NEAREST',
  [ResamplingMethod.BILINEAR]: 'BILINEAR',
  [ResamplingMethod.CUBIC]: 'CUBIC'
};

export const CompressionMapping = {
  [CompressionType.NONE]: 'NONE',
  [CompressionType.LZW]: 'LZW',
  [CompressionType.JPEG]: 'JPEG',
  [CompressionType.DEFLATE]: 'DEFLATE',
}
