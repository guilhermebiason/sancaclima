import type { MeteorologicalVariable } from "../../../../types/meteorology";

export interface InmetStationMetadata {
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  elevationMeters: number | null;
  situation: string | null;
  startDate: string | null;
  endDate: string | null;
  measurementPeriodicity: string | null;
}

export interface InmetHourlyValues {
  precipitation: number | null;
  solarRadiation: number | null;
  airTemperature: number | null;
  relativeHumidity: number | null;
  windDirection: number | null;
  windSpeed: number | null;
}

export interface InmetHourlyRecord {
  observedAt: string;
  values: InmetHourlyValues;
  sourceLine: number;
}

export interface ParsedInmetCsv {
  station: InmetStationMetadata;
  records: InmetHourlyRecord[];
  sourceHeaders: string[];
}

export const INMET_VARIABLE_MAP: Record<
  keyof InmetHourlyValues,
  { variable: MeteorologicalVariable; unit: string; aggregation: "hourly" | "accumulated" }
> = {
  precipitation: { variable: "precipitation", unit: "mm", aggregation: "accumulated" },
  solarRadiation: { variable: "solar_radiation", unit: "kJ/m²", aggregation: "accumulated" },
  airTemperature: { variable: "air_temperature", unit: "°C", aggregation: "hourly" },
  relativeHumidity: { variable: "relative_humidity", unit: "%", aggregation: "hourly" },
  windDirection: { variable: "wind_direction", unit: "°", aggregation: "hourly" },
  windSpeed: { variable: "wind_speed", unit: "m/s", aggregation: "hourly" },
};
