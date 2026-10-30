-- ClimaBR: armazenamento inicial de dados meteorológicos.
-- PostgreSQL 15+ (compatível com Neon). Aplicar uma única vez por ambiente.
-- O conteúdo bruto é preservado separadamente das observações normalizadas.

BEGIN;

CREATE TABLE meteorological_data_sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('INMET', 'REDEMET', 'METEOSTAT', 'OTHER')),
  name TEXT NOT NULL,
  product TEXT,
  documentation_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meteorological_stations (
  id TEXT PRIMARY KEY,
  source_station_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES meteorological_data_sources(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  elevation_meters NUMERIC(9, 2),
  state CHAR(2),
  municipality TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, source_station_id)
);

CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES meteorological_data_sources(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  station_id TEXT REFERENCES meteorological_stations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partially_succeeded', 'failed')),
  records_read INTEGER NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_accepted INTEGER NOT NULL DEFAULT 0 CHECK (records_accepted >= 0),
  records_rejected INTEGER NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX ingestion_runs_source_started_idx
  ON ingestion_runs (source_id, started_at DESC);

CREATE INDEX ingestion_runs_status_started_idx
  ON ingestion_runs (status, started_at DESC);

-- Para a primeira fase, o arquivo original é preservado em BYTEA.
-- Se o volume crescer, o conteúdo poderá migrar para object storage,
-- mantendo nesta tabela os metadados e a chave externa.
CREATE TABLE raw_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'text/csv',
  sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  content BYTEA NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  UNIQUE (ingestion_run_id, sha256)
);

CREATE TABLE raw_records (
  id TEXT PRIMARY KEY,
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  raw_file_id UUID NOT NULL REFERENCES raw_files(id) ON DELETE RESTRICT,
  source_line INTEGER NOT NULL CHECK (source_line > 0),
  observed_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL,
  UNIQUE (ingestion_run_id, source_line)
);

CREATE INDEX raw_records_file_line_idx
  ON raw_records (raw_file_id, source_line);

CREATE TABLE meteorological_observations (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES meteorological_stations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  source_id TEXT NOT NULL REFERENCES meteorological_data_sources(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ingestion_run_id UUID REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  variable TEXT NOT NULL CHECK (variable IN (
    'air_temperature',
    'dew_point_temperature',
    'relative_humidity',
    'sea_level_pressure',
    'precipitation',
    'wind_speed',
    'wind_direction',
    'solar_radiation'
  )),
  value DOUBLE PRECISION,
  unit TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  aggregation TEXT NOT NULL CHECK (aggregation IN ('instantaneous', 'hourly', 'daily', 'accumulated')),
  statistic TEXT CHECK (statistic IS NULL OR statistic IN ('minimum', 'maximum', 'mean', 'sum', 'range', 'count')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  method TEXT CHECK (method IS NULL OR method IN ('measured', 'calculated', 'derived')),
  coverage_expected_records INTEGER,
  coverage_available_records INTEGER,
  coverage_completeness_ratio NUMERIC(7, 6),
  quality TEXT NOT NULL CHECK (quality IN ('pending', 'valid', 'suspect', 'invalid')),
  quality_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  raw_record_id TEXT REFERENCES raw_records(id) ON DELETE RESTRICT,
  source_record_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (period_start IS NULL AND period_end IS NULL)
    OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
  ),
  CHECK (
    (coverage_expected_records IS NULL AND coverage_available_records IS NULL AND coverage_completeness_ratio IS NULL)
    OR (
      coverage_expected_records IS NOT NULL
      AND coverage_available_records IS NOT NULL
      AND coverage_completeness_ratio IS NOT NULL
      AND coverage_expected_records > 0
      AND coverage_available_records >= 0
      AND coverage_available_records <= coverage_expected_records
      AND coverage_completeness_ratio BETWEEN 0 AND 1
    )
  )
);

-- Acesso principal do dashboard: estação + variável + intervalo temporal.
CREATE INDEX meteorological_observations_station_variable_time_idx
  ON meteorological_observations (station_id, variable, observed_at DESC);

CREATE INDEX meteorological_observations_station_time_idx
  ON meteorological_observations (station_id, observed_at DESC);

CREATE INDEX meteorological_observations_run_idx
  ON meteorological_observations (ingestion_run_id);

CREATE INDEX meteorological_observations_suspect_idx
  ON meteorological_observations (station_id, observed_at DESC)
  WHERE quality IN ('suspect', 'invalid');

-- Impede reimportação duplicada de um mesmo registro identificado pela fonte.
-- IDs determinísticos também protegem os registros derivados e agregados.
CREATE UNIQUE INDEX meteorological_observations_source_record_uidx
  ON meteorological_observations (source_id, source_record_id)
  WHERE source_record_id IS NOT NULL;

COMMIT;
