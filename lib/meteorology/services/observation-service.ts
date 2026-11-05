
import type { Pool } from "pg";
import type {
  MeteorologicalObservation,
  ObservationAggregation,
} from "../../../types/meteorology";
import { readMeteorologicalObservations } from "../persistence/postgres-repository";

export interface ObservationServiceInput {
  stationId: string;
  from: string;
  to: string;
  variables?: string[];
  aggregations?: ObservationAggregation[];
  limit?: number;
}

/**
 * Retorna observações meteorológicas de uma estação.
 */
export async function getStationObservations(
  pool: Pool,
  input: ObservationServiceInput,
): Promise<MeteorologicalObservation[]> {
  return readMeteorologicalObservations(pool, {
    stationId: input.stationId,
    from: input.from,
    to: input.to,
    variables: input.variables,
    aggregations: input.aggregations,
    limit: input.limit,
  });
}

/**
 * Retorna estatísticas diárias calculadas para uma estação.
 */
export async function getDailySummaries(
  pool: Pool,
  input: ObservationServiceInput,
): Promise<MeteorologicalObservation[]> {
  return readMeteorologicalObservations(pool, {
    stationId: input.stationId,
    from: input.from,
    to: input.to,
    variables: input.variables,
    aggregations: ["daily"],
    limit: input.limit,
  });
}

/**
 * Retorna observações sinalizadas como suspeitas ou inválidas.
 */
export async function getStationQualityReport(
  pool: Pool,
  input: ObservationServiceInput,
): Promise<MeteorologicalObservation[]> {
  return readMeteorologicalObservations(pool, {
    stationId: input.stationId,
    from: input.from,
    to: input.to,
    variables: input.variables,
    qualities: ["suspect", "invalid"],
    limit: input.limit,
  });
}