import { GcpDto } from "./gcp-dto";
import { GeorefImageDto } from "./georef-image-dto";

export interface RegeorefResponse {
    georefImageDto: GeorefImageDto,
    gcpDtos: GcpDto[],
}