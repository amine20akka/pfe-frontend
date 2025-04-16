import { GCP } from "../models/gcp";

export interface GcpDto {
    id?: string;
    imageId?: string;
    sourceX: number;
    sourceY: number;
    mapX?: number;
    mapY?: number;
    index: number;
    residual?: number;
}

// Converts a GCP object to a GCPDto object
export function ToDto(gcp: GCP, imageId: string): GcpDto {
    return {
        id: gcp.id,
        imageId: imageId,
        sourceX: gcp.sourceX,
        sourceY: gcp.sourceY,
        mapX: gcp.mapX,
        mapY: gcp.mapY,
        index: gcp.index,
        residual: gcp.residual
    };
}
// Converts a GCPDto object to a GCP object
export function FromDto(gcpDto: GcpDto): GCP {
    return {
        id: gcpDto.id,
        imageId: gcpDto.imageId,
        sourceX: gcpDto.sourceX,
        sourceY: gcpDto.sourceY,
        mapX: gcpDto.mapX,
        mapY: gcpDto.mapY,
        index: gcpDto.index,
        residual: gcpDto.residual
    };
}