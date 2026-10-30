/**
 * Contratos canônicos para a infraestrutura de dados meteorológicos.
 * O modelo legado continua atendendo ao dashboard durante a transição.
 */

export type DataSourceProvider = "INMET" | "REDEMET" | "METEOSTAT" | "OTHER";

export type MeteorologicalVariable =
  | "air_temperature"
  | "relative_humidity"
  | "sea_level_pressure"
  | "precipitation"
  | "wind_speed"
  | "wind_direction"
  | "solar_radiation";

export type ObservationAggregation = "instantaneous" | "hourly" | "daily" | "accumulated";

/**
 * Estatística representada por uma observação.
 * Ausência significa que o registro representa o valor fornecido pela fonte,
 * sem uma estatística adicional calculada pelo ClimaBR.
 */
export type ObservationStatistic =
  | "minimum"
  | "maximum"
  | "mean"
  | "sum"
  | "range"
  | "count";

/** Como o valor foi obtido, sem confundir cálculo com a origem dos dados. */
export type ObservationMethod = "measured" | "calculated" | "derived";

/**
 * Cobertura temporal usada em uma agregação.
 * completenessRatio varia de 0 a 1 (availableRecords / expectedRecords).
 */
export interface ObservationCoverage {
  expectedRecords: number;
  availableRecords: number;
  completenessRatio: number;
}

export type QualityStatus = "pending" | "valid" | "suspect" | "invalid";

export type QualityFlag =
  | "missing_value"
  | "outside_physical_range"
  | "duplicate"
  | "timestamp_out_of_order"
  | "stale"
  | "spatial_inconsistency"
  | "source_warning"
  | "insufficient_coverage"
  | "derived_from_suspect_data";

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
  /** Estatística representada, como mínima, máxima ou média. */
  statistic?: ObservationStatistic;
  /** Limites do período considerado, em ISO 8601 UTC. */
  periodStart?: string;
  periodEnd?: string;
  /** Medido na fonte, calculado por agregação ou derivado de outras variáveis. */
  method?: ObservationMethod;
  /** Cobertura dos registros usados em uma agregação temporal. */
  coverage?: ObservationCoverage;
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
