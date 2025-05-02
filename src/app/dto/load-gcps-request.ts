import { GcpDto } from "./gcp-dto";

export interface LoadGcpsRequest {
    imageId: string;
    gcps: GcpDto[];
    overwrite: boolean;
}