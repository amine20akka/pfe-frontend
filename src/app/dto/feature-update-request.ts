/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
export interface FeatureUpdateRequest {
    geometry: string;
    properties: { [key: string]: any };
}