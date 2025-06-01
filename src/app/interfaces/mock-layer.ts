import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";

export interface MockLayer {
    layerId: string;
    name: string;
    wfsLayer: VectorLayer<VectorSource>;
    opacity: number;
}