import { GCP } from "../models/gcp.model";

export interface GcpDto {
    id?: string;
    imageId: string;
    sourceX: number;
    sourceY: number;
    mapX?: number;
    mapY?: number;
    index: number;
    residual?: number;
}


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

export function FromDto(gcpDto: GcpDto): GCP {
    return {
        id: gcpDto.id!,
        imageId: gcpDto.imageId,
        sourceX: gcpDto.sourceX,
        sourceY: gcpDto.sourceY,
        mapX: gcpDto.mapX,
        mapY: gcpDto.mapY,
        index: gcpDto.index,
        residual: gcpDto.residual
    };
}

export function FromDtos(gcpDtos: GcpDto[]): GCP[] {
    return gcpDtos.map(gcpDto => ({
        id: gcpDto.id!,
        imageId: gcpDto.imageId,
        sourceX: gcpDto.sourceX,
        sourceY: gcpDto.sourceY,
        mapX: gcpDto.mapX,
        mapY: gcpDto.mapY,
        index: gcpDto.index,
        residual: gcpDto.residual
    }));
}