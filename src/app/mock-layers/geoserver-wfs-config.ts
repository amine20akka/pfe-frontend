export const GEOSERVER_CONFIG = {
    baseUrl: 'http://localhost:8080/geoserver/drawing/ows',
    params: {
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        outputFormat: 'application/json',
        srsname: 'EPSG:3857'
    }
};