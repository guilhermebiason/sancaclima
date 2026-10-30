import type {
  MeteorologicalDataSource,
  MeteorologicalObservation,
  MeteorologicalStation,
} from "../../../../types/meteorology";
import { INMET_VARIABLE_MAP, type InmetHourlyValues, type ParsedInmetCsv } from "./types";
import { applyInmetQualityControl } from "./quality-control";

export interface NormalizedInmetData {
  dataSource: MeteorologicalDataSource;
  station: MeteorologicalStation;
  observations: MeteorologicalObservation[];
}

const SOURCE_ID = "inmet-bdmep";

export function normalizeInmetCsv(
  parsed: ParsedInmetCsv,
  receivedAt = new Date().toISOString(),
): NormalizedInmetData {
  if (Number.isNaN(Date.parse(receivedAt))) {
    throw new Error("receivedAt deve ser um timestamp ISO 8601 válido.");
  }

  const stationId = `INMET:${parsed.station.code}`;
  const isInitialStation = parsed.station.code.toUpperCase() === "A711";
  const dataSource: MeteorologicalDataSource = {
    id: SOURCE_ID,
    provider: "INMET",
    name: "INMET — Banco de Dados Meteorológicos (BDMEP)",
    product: "Dados horários de estações automáticas",
    documentationUrl: "https://bdmep.inmet.gov.br/",
  };

  const station: MeteorologicalStation = {
    id: stationId,
    sourceStationId: parsed.station.code,
    sourceId: SOURCE_ID,
    name: parsed.station.name,
    latitude: parsed.station.latitude,
    longitude: parsed.station.longitude,
    elevationMeters: parsed.station.elevationMeters ?? undefined,
    ...(isInitialStation ? { state: "SP", municipality: "São Carlos" } : {}),
    active: parsed.station.situation?.toLowerCase() === "operante",
  };

  const observations: MeteorologicalObservation[] = [];
  const valueKeys = Object.keys(INMET_VARIABLE_MAP) as Array<keyof InmetHourlyValues>;

  for (const record of parsed.records) {
    for (const key of valueKeys) {
      const mapping = INMET_VARIABLE_MAP[key];
      const value = record.values[key];
      const sourceRecordId = `${parsed.station.code}:${record.observedAt}:line-${record.sourceLine}:${mapping.variable}`;

      observations.push({
        id: sourceRecordId,
        stationId,
        sourceId: SOURCE_ID,
        variable: mapping.variable,
        value,
        unit: mapping.unit,
        observedAt: record.observedAt,
        receivedAt,
        aggregation: mapping.aggregation,
        quality: "pending",
        qualityFlags: [],
        sourceRecordId,
      });
    }
  }

  return {
    dataSource,
    station,
    observations: applyInmetQualityControl(observations),
  };
}
