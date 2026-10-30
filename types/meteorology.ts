/**
 * Contratos canônicos para a infraestrutura de dados meteorológicos.
 * O modelo legado continua atendendo ao dashboard durante a transição.
 */

export type DataSourceProvider = "INMET" | "REDEMET" | "OTHER";

export type MeteorologicalVariable =
  | "air_temperature"
  | "relative_humidity"
  | "station_pressure"
  | "precipitation"
  | "wind_speed"
  | "wind_direction"
  | "solar_radiation";

export type ObservationAggregation = "instantaneous" | "hourly" | "daily" | "accumulated";
export type QualityStatus = "pending" | "valid" | "suspect" | "invalid";

export type QualityFlag =
  | "missing_value"
  | "outside_physical_range"
  | "duplicate"
  | "timestamp_out_of_order"
  | "stale"
  | "spatial_inconsistency"
  | "source_warning";

export interface MeteorologicalDataSource {
  id: string;
  provider: DataSourceProvider;
  name: string;
  product?: string;
  documentationUrl?: string;
}

export interface MeteorologicalStation {
  id: string;
  sourceStationId: string;
  sourceId: string;
  name: string;
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  state?: string;
  municipality?: string;
  active: boolean;
}

export interface MeteorologicalObservation {
  id: string;
  stationId: string;
  sourceId: string;
  variable: MeteorologicalVariable;
  value: number | null;
  unit: string;
  /** Instante da medição, normalizado para ISO 8601 em UTC. */
  observedAt: string;
  /** Instante em que o ClimaBR recebeu/importou o registro, em UTC. */
  receivedAt: string;
  aggregation: ObservationAggregation;
  quality: QualityStatus;
  qualityFlags: QualityFlag[];
  rawRecordId?: string;
  sourceRecordId?: string;
}

export type IngestionRunStatus = "running" | "succeeded" | "partially_succeeded" | "failed";

export interface IngestionRun {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt?: string;
  status: IngestionRunStatus;
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  errorMessage?: string;
}
