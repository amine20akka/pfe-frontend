import { GeorefStatus } from "../enums/georef-status";
import { GeorefLayer } from "../models/georef-layer.model";

export interface GeorefResponse {
    enoughGCPs: boolean;
    minPointsRequired: number;
    message: string
    status: GeorefStatus;
    lastGeoreferencingDate: Date;
    georefLayer: GeorefLayer;
}