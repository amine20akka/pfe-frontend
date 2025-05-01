import { TransformationType } from "../enums/transformation-type";
import { GcpDto } from "./gcp-dto";

export interface ResidualsResponse {
    success: boolean;
    gcpDtos: GcpDto[];
    rmse: number;
    minPointsRequired: number;
}

export interface ResidualsRequest {
    imageId: string;
    type: TransformationType;
    srid: number;
}