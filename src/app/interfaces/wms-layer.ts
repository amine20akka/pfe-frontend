import TileLayer from "ol/layer/Tile";

export interface WMSLayer {
    layer: TileLayer,
    layerName: string
}