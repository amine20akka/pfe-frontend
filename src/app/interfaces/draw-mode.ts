// Types pour les outils de dessin standards/simples
export type SimpleDrawMode = 'Point' | 'LineString' | 'Polygon' | 'Circle';

// Types pour les outils de dessin avancés
export type AdvancedDrawMode = 'Arc' | 'Tracing' | 'Perpendicular' | 'TracingBuffer';

// Type DrawMode complet
export type DrawMode = SimpleDrawMode | AdvancedDrawMode;

// Pour faciliter l'utilisation, vous pouvez ajouter des objets constants contenant les valeurs
export const SimpleDrawModes: Record<string, SimpleDrawMode> = {
  POINT: 'Point',
  LINE_STRING: 'LineString',
  POLYGON: 'Polygon',
  CIRCLE: 'Circle'
};

export const AdvancedDrawModes: Record<string, AdvancedDrawMode> = {
  ARC: 'Arc',
  TRACING: 'Tracing',
  PERPENDICULAR: 'Perpendicular',
  TRACING_BUFFER: 'TracingBuffer'
};

// Pour accéder facilement à toutes les valeurs
export const DrawModes = {
  ...SimpleDrawModes,
  ...AdvancedDrawModes
};