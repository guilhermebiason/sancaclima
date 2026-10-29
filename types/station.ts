export type StationType = "automatica" | "convencional" | "aeroporto";
export type StationStatus = "online" | "atrasada" | "offline";
export type Region =
  | "Norte"
  | "Nordeste"
  | "Centro-Oeste"
  | "Sudeste"
  | "Sul";

export type WeatherVariable =
  | "temperature"
  | "humidity"
  | "pressure"
  | "precipitation"
  | "windSpeed";

export interface StationObservation {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  dewPoint: number;
  feelsLike: number;
  visibility: number;
  cloudCover: number;
  uvIndex: number;
}

export interface StationForecast {
  timestamp: string;
  temperature: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  condition: string;
}

export interface WeatherStation {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  region: Region;
  type: StationType;
  status: StationStatus;
  latitude: number;
  longitude: number;
  elevation: number;
  operator: string;
  installedAt: string;
  lastUpdate: string;
  current: StationObservation;
  history: StationObservation[];
  daily: StationObservation[];
  forecast: StationForecast[];
}

export const VARIABLE_LABELS: Record<WeatherVariable, string> = {
  temperature: "Temperatura",
  humidity: "Umidade",
  pressure: "Pressão",
  precipitation: "Precipitação",
  windSpeed: "Vento",
};

export const VARIABLE_UNITS: Record<WeatherVariable, string> = {
  temperature: "°C",
  humidity: "%",
  pressure: "hPa",
  precipitation: "mm",
  windSpeed: "km/h",
};

export const REGION_OPTIONS: Region[] = [
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul",
];

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  automatica: "Automática",
  convencional: "Convencional",
  aeroporto: "Aeroporto",
};

export const STATUS_LABELS: Record<StationStatus, string> = {
  online: "Online",
  atrasada: "Atrasada",
  offline: "Offline",
};
