import type { WeatherVariable } from "./station";

export interface HeatmapState {
  enabled: boolean;
  variable: WeatherVariable;
  opacity: number;
}

export interface OverlayState {
  enabled: boolean;
  opacity: number;
}

export interface MapLayerState {
  heatmap: HeatmapState;
  satellite: OverlayState;
  radar: OverlayState;
}

export interface MapFilters {
  region: string;
  type: string;
  status: string;
  query: string;
}

export const DEFAULT_MAP_LAYERS: MapLayerState = {
  heatmap: { enabled: false, variable: "temperature", opacity: 0.75 },
  satellite: { enabled: false, opacity: 0.65 },
  radar: { enabled: false, opacity: 0.7 },
};

export const DEFAULT_MAP_FILTERS: MapFilters = {
  region: "todas",
  type: "todos",
  status: "todos",
  query: "",
};

export const HEATMAP_RANGES: Record<
  WeatherVariable,
  { min: number; max: number }
> = {
  temperature: { min: 5, max: 38 },
  precipitation: { min: 0, max: 12 },
  humidity: { min: 30, max: 100 },
  windSpeed: { min: 0, max: 45 },
  pressure: { min: 990, max: 1030 },
};
