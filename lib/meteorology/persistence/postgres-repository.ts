import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  MeteorologicalDataSource,
  MeteorologicalObservation,
  MeteorologicalStation,
} from "../../../types/meteorology";

export interface RawInmetRecord {
  id: string;
  sourceLine: number;
  observedAt: string;
  rawPayload: Record<string, unknown>;
}

export interface PersistInmetImportInput {
  pool: Pool;
  dataSource: MeteorologicalDataSource;
  station: MeteorologicalStation;
  observations: MeteorologicalObservation[];
  rawRecords: RawInmetRecord[];
  rawFile: Buffer;
  fileName: string;
  receivedAt: string;
  startedAt?: string;
}

export interface PersistInmetImportResult {
  ingestionRunId: string;
  rawRecordCount: number;
  observationCount: number;
  rawFileSha256: string;
}

const OBSERVATION_COLUMNS = [
  "id", "station_id", "source_id", "ingestion_run_id", "variable", "value",
  "unit", "observed_at", "received_at", "aggregation", "statistic",
  "period_start", "period_end", "method", "coverage_expected_records",
  "coverage_available_records", "coverage_completeness_ratio", "quality",
  "quality_flags", "raw_record_id", "source_record_id",
] as const;

function placeholders(rowIndex: number, columnCount: number): string {
  const offset = rowIndex * columnCount;
  return `(${Array.from({ length: columnCount }, (_, index) => `$${offset + index + 1}`).join(", ")})`;
}

async function insertObservationBatch(
  client: PoolClient,
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  const values = rows.flat();
  const tuples = rows.map((_, index) => placeholders(index, OBSERVATION_COLUMNS.length));
  const updates = OBSERVATION_COLUMNS
    .filter((column) => column !== "id")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  await client.query(
    `INSERT INTO meteorological_observations (${OBSERVATION_COLUMNS.join(", ")})
     VALUES ${tuples.join(", ")}
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values,
  );
}

/**
 * Persiste o arquivo original, linhas brutas e observações em uma única transação.
 * Reimportações atualizam observações com IDs determinísticos em vez de duplicá-las.
 */
export async function persistInmetImport(
  input: PersistInmetImportInput,
): Promise<PersistInmetImportResult> {
  if (Number.isNaN(Date.parse(input.receivedAt))) {
    throw new Error("receivedAt deve ser um timestamp ISO 8601 válido.");
  }
  if (input.rawFile.length === 0) {
    throw new Error("O arquivo bruto não pode estar vazio.");
  }
  if (input.rawRecords.length === 0) {
    throw new Error("A importação precisa conter ao menos um registro bruto.");
  }

  const client = await input.pool.connect();
  const ingestionRunId = randomUUID();
  const startedAt = input.startedAt ?? input.receivedAt;
  const rawFileSha256 = createHash("sha256").update(input.rawFile).digest("hex");
  const rawFileId = randomUUID();
  // Cada execução mantém sua própria cópia rastreável das linhas brutas.
  const rawRecordByTimestamp = new Map(
    input.rawRecords.map((record) => [record.observedAt, `${ingestionRunId}:${record.id}`]),
  );

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO meteorological_data_sources
       (id, provider, name, product, documentation_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         name = EXCLUDED.name,
         product = EXCLUDED.product,
         documentation_url = EXCLUDED.documentation_url,
         updated_at = NOW()`,
      [
        input.dataSource.id,
        input.dataSource.provider,
        input.dataSource.name,
        input.dataSource.product ?? null,
        input.dataSource.documentationUrl ?? null,
      ],
    );

    await client.query(
      `INSERT INTO meteorological_stations
       (id, source_station_id, source_id, name, latitude, longitude,
        elevation_meters, state, municipality, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         source_station_id = EXCLUDED.source_station_id,
         source_id = EXCLUDED.source_id,
         name = EXCLUDED.name,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         elevation_meters = EXCLUDED.elevation_meters,
         state = EXCLUDED.state,
         municipality = EXCLUDED.municipality,
         active = EXCLUDED.active,
         updated_at = NOW()`,
      [
        input.station.id,
        input.station.sourceStationId,
        input.station.sourceId,
        input.station.name,
        input.station.latitude,
        input.station.longitude,
        input.station.elevationMeters ?? null,
        input.station.state ?? null,
        input.station.municipality ?? null,
        input.station.active,
      ],
    );

    await client.query(
      `INSERT INTO ingestion_runs
       (id, source_id, station_id, started_at, status, records_read)
       VALUES ($1, $2, $3, $4, 'running', $5)`,
      [ingestionRunId, input.dataSource.id, input.station.id, startedAt, input.rawRecords.length],
    );

    await client.query(
      `INSERT INTO raw_files
       (id, ingestion_run_id, file_name, media_type, sha256, size_bytes, content, received_at)
       VALUES ($1, $2, $3, 'text/csv', $4, $5, $6, $7)`,
      [
        rawFileId,
        ingestionRunId,
        input.fileName,
        rawFileSha256,
        input.rawFile.length,
        input.rawFile,
        input.receivedAt,
      ],
    );

    const rawRows = input.rawRecords.map((record) => [
      rawRecordByTimestamp.get(record.observedAt),
      ingestionRunId,
      rawFileId,
      record.sourceLine,
      record.observedAt,
      JSON.stringify(record.rawPayload),
    ]);
    for (let offset = 0; offset < rawRows.length; offset += 500) {
      const batch = rawRows.slice(offset, offset + 500);
      const values = batch.flat();
      const tuples = batch.map((_, index) => placeholders(index, 6));
      await client.query(
        `INSERT INTO raw_records
         (id, ingestion_run_id, raw_file_id, source_line, observed_at, raw_payload)
         VALUES ${tuples.join(", ")}
         ON CONFLICT (id) DO NOTHING`,
        values,
      );
    }

    const observationRows = input.observations.map((observation) => [
      observation.id,
      observation.stationId,
      observation.sourceId,
      ingestionRunId,
      observation.variable,
      observation.value,
      observation.unit,
      observation.observedAt,
      observation.receivedAt,
      observation.aggregation,
      observation.statistic ?? null,
      observation.periodStart ?? null,
      observation.periodEnd ?? null,
      observation.method ?? null,
      observation.coverage?.expectedRecords ?? null,
      observation.coverage?.availableRecords ?? null,
      observation.coverage?.completenessRatio ?? null,
      observation.quality,
      observation.qualityFlags,
      observation.rawRecordId ?? rawRecordByTimestamp.get(observation.observedAt) ?? null,
      observation.sourceRecordId ?? null,
    ]);
    for (let offset = 0; offset < observationRows.length; offset += 300) {
      await insertObservationBatch(client, observationRows.slice(offset, offset + 300));
    }

    const rejectedRecords = input.rawRecords.filter((record) =>
      input.observations.some((observation) =>
        observation.observedAt === record.observedAt && observation.quality === "invalid",
      ),
    ).length;
    const acceptedRecords = input.rawRecords.length - rejectedRecords;
    const status = rejectedRecords > 0 ? "partially_succeeded" : "succeeded";

    await client.query(
      `UPDATE ingestion_runs
       SET finished_at = $2, status = $3, records_accepted = $4, records_rejected = $5
       WHERE id = $1`,
      [ingestionRunId, input.receivedAt, status, acceptedRecords, rejectedRecords],
    );

    await client.query("COMMIT");

    return {
      ingestionRunId,
      rawRecordCount: input.rawRecords.length,
      observationCount: input.observations.length,
      rawFileSha256,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface ReadObservationsInput {
  stationId: string;
  from: string;
  to: string;
  variables?: string[];
  limit?: number;
}

/** Leitura paginada temporal para serviços de API executados exclusivamente no servidor. */
export async function readMeteorologicalObservations(
  pool: Pool,
  input: ReadObservationsInput,
): Promise<MeteorologicalObservation[]> {
  const fromTimestamp = Date.parse(input.from);
  const toTimestamp = Date.parse(input.to);
  if (!Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp) || fromTimestamp >= toTimestamp) {
    throw new Error("Informe timestamps ISO 8601 válidos e um início anterior ao fim.");
  }
  const limit = Math.min(Math.max(input.limit ?? 5000, 1), 20_000);
  const values: unknown[] = [input.stationId, input.from, input.to];
  let variableFilter = "";
  if (input.variables?.length) {
    values.push(input.variables);
    variableFilter = ` AND variable = ANY($${values.length}::text[])`;
  }
  values.push(limit);

  const result = await pool.query(
    `SELECT id, station_id, source_id, variable, value, unit,
            observed_at, received_at, aggregation, statistic,
            period_start, period_end, method,
            coverage_expected_records, coverage_available_records,
            coverage_completeness_ratio, quality, quality_flags,
            raw_record_id, source_record_id
     FROM meteorological_observations
     WHERE station_id = $1 AND observed_at >= $2 AND observed_at < $3
       ${variableFilter}
     ORDER BY observed_at ASC, variable ASC, statistic ASC
     LIMIT $${values.length}`,
    values,
  );

  return result.rows.map((row) => ({
    id: row.id,
    stationId: row.station_id,
    sourceId: row.source_id,
    variable: row.variable,
    value: row.value === null ? null : Number(row.value),
    unit: row.unit,
    observedAt: new Date(row.observed_at).toISOString(),
    receivedAt: new Date(row.received_at).toISOString(),
    aggregation: row.aggregation,
    ...(row.statistic ? { statistic: row.statistic } : {}),
    ...(row.period_start ? { periodStart: new Date(row.period_start).toISOString() } : {}),
    ...(row.period_end ? { periodEnd: new Date(row.period_end).toISOString() } : {}),
    ...(row.method ? { method: row.method } : {}),
    ...(row.coverage_expected_records !== null ? {
      coverage: {
        expectedRecords: Number(row.coverage_expected_records),
        availableRecords: Number(row.coverage_available_records),
        completenessRatio: Number(row.coverage_completeness_ratio),
      },
    } : {}),
    quality: row.quality,
    qualityFlags: row.quality_flags,
    ...(row.raw_record_id ? { rawRecordId: row.raw_record_id } : {}),
    ...(row.source_record_id ? { sourceRecordId: row.source_record_id } : {}),
  }));
}
