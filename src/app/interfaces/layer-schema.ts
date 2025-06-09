export interface LayerSchema {
  geometryType: string;
  attributes: Attribute[];
}

export interface Attribute {
  label: string;
  type: string;
  options?: Option[];
}

export interface Option {
  value: string | number | boolean;
  label: string;
}