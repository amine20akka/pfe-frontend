import { GCP } from "./gcp";
import { TransformationType } from "./georef-settings";

export interface ResidualsResponse {
    residuals: number[];
    rmse: number;
}

export interface ResidualsRequest {
    gcps: GCP[];
    transformationType: TransformationType;
    srid: number;
}