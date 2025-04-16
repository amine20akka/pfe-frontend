import { GCP } from "../models/gcp";
import { TransformationType } from "../models/georef-settings";

export interface ResidualsResponse {
    residuals: number[];
    rmse: number;
}

export interface ResidualsRequest {
    gcps: GCP[];
    transformationType: TransformationType;
    srid: number;
}