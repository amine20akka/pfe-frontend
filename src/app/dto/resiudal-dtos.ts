import { TransformationType } from "../enums/transformation-type";
import { GCP } from "../models/gcp.model";

export interface ResidualsResponse {
    residuals: number[];
    rmse: number;
}

export interface ResidualsRequest {
    gcps: GCP[];
    transformationType: TransformationType;
    srid: number;
}