import TileLayer from "ol/layer/Tile";
import { LayerStatus } from "../enums/layer-status";

export interface GeorefLayer {
  id: string;
  imageId: string;
  layer?: TileLayer;
  layerName: string;
  workspace: string;
  storeName: string;
  wmsUrl: string;
  status: LayerStatus;
  opacity?: number;
}