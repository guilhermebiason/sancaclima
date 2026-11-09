import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { Pool } from "pg";
import {
  persistInmetImport,
} from "../../lib/meteorology/persistence/postgres-repository";
import type {
  MeteorologicalObservation,
} from "../../types/meteorology";

test("PostgreSQL real: preserva arquivo, proveniência, duplicatas, idempotência e rollback", async () => {
  const password = process.env.CLIMABR_TEST_DB_PASSWORD;

  assert.ok(password, "Configure CLIMABR_TEST_DB_PASSWORD antes do teste.");

  // Conexão fixa e exclusivamente local.
  // Não utiliza DATABASE_URL nem carrega .env.local.
  const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "climabr_test",
    user: "postgres",
    password,
    ssl: false,
    max: 2,
  });

  const suffix = randomUUID();
  const sourceId = `test-source-${suffix}`;
  const stationId = `test-station-${suffix}`;
  const stationCode = `TEST-${suffix}`;
  const receivedAt = new Date().toISOString();
  const observedAt = "2026-10-22T03:00:00.000Z";

  const rawRecords = [
    {
      id: `${stationCode}:${observedAt}:line-2`,
      sourceLine: 2,
      observedAt,
      rawPayload: { solar_radiation: -3.5, original_line: 2 },
    },
    {
      id: `${stationCode}:${observedAt}:line-3`,
      sourceLine: 3,
      observedAt,
      rawPayload: { solar_radiation: -0.2, original_line: 3 },
    },
  ];

  const observations: MeteorologicalObservation[] = rawRecords.map(
    (record) => ({
      id: `${record.id}:solar_radiation`,
      stationId,
      sourceId,
      variable: "solar_radiation",
      value: record.rawPayload.solar_radiation,
      unit: "kJ/m²",
      observedAt,
      receivedAt,
      aggregation: "hourly",
      method: "measured",
      quality: "suspect",
      qualityFlags: ["outside_physical_range"],
      sourceRecordId: `${record.id}:solar_radiation`,
    }),
  );

  const rawFile = gzipSync(
    Buffer.from(
      "synthetic INMET test payload; original bytes must remain unchanged",
      "utf8",
    ),
  );

  const dataSource = {
    id: sourceId,
    provider: "INMET" as const,
    name: "INMET integration test",
  };

  const station = {
    id: stationId,
    sourceStationId: stationCode,
    sourceId,
    name: "Synthetic test station",
    latitude: -22,
    longitude: -47.89,
    active: true,
  };

  const successfulRunIds: string[] = [];

  try {
    await pool.query("SELECT 1");

    // Primeira persistência real.
    const first = await persistInmetImport({
      pool,
      dataSource,
      station,
      observations,
      rawRecords,
      rawFile,
      fileName: "synthetic-test.csv.gz",
      mediaType: "application/gzip",
      receivedAt,
    });

    successfulRunIds.push(first.ingestionRunId);

    assert.equal(first.rawRecordCount, 2);
    assert.equal(first.observationCount, 2);

    // Confere os bytes GZIP originais.
    const fileResult = await pool.query(
      `SELECT content, media_type, size_bytes, sha256
       FROM raw_files
       WHERE ingestion_run_id = $1`,
      [first.ingestionRunId],
    );

    assert.equal(fileResult.rowCount, 1);
    assert.deepEqual(
      Buffer.from(fileResult.rows[0].content),
      rawFile,
    );
    assert.equal(fileResult.rows[0].media_type, "application/gzip");
    assert.equal(Number(fileResult.rows[0].size_bytes), rawFile.length);

    // Confere as duas linhas com o mesmo horário.
    const rawResult = await pool.query(
      `SELECT id, source_line, observed_at
       FROM raw_records
       WHERE ingestion_run_id = $1
       ORDER BY source_line`,
      [first.ingestionRunId],
    );

    assert.equal(rawResult.rowCount, 2);
    assert.notEqual(rawResult.rows[0].id, rawResult.rows[1].id);
    assert.equal(
      new Date(rawResult.rows[0].observed_at).toISOString(),
      new Date(rawResult.rows[1].observed_at).toISOString(),
    );

    // Segunda persistência: mesmos IDs de observação.
    // Deve atualizar, não duplicar as observações.
    const second = await persistInmetImport({
      pool,
      dataSource,
      station,
      observations,
      rawRecords,
      rawFile,
      fileName: "synthetic-test.csv.gz",
      mediaType: "application/gzip",
      receivedAt,
    });

    successfulRunIds.push(second.ingestionRunId);

    const observationResult = await pool.query(
      `SELECT id, value, quality, quality_flags,
              raw_record_id, source_record_id
       FROM meteorological_observations
       WHERE station_id = $1
       ORDER BY value`,
      [stationId],
    );

    assert.equal(observationResult.rowCount, 2);

    assert.deepEqual(
      observationResult.rows.map((row) => Number(row.value)),
      [-3.5, -0.2],
    );

    for (const row of observationResult.rows) {
      assert.equal(row.quality, "suspect");
      assert.ok(row.quality_flags.includes("outside_physical_range"));
      assert.ok(row.raw_record_id);
      assert.ok(row.source_record_id);
    }

    // Os vínculos devem apontar para as linhas da segunda importação.
    const secondRawResult = await pool.query(
      `SELECT id, source_line
       FROM raw_records
       WHERE ingestion_run_id = $1`,
      [second.ingestionRunId],
    );

    const secondRawIds = new Set(
      secondRawResult.rows.map((row) => row.id),
    );

    for (const row of observationResult.rows) {
      assert.ok(secondRawIds.has(row.raw_record_id));
    }

    // Verifica que a segunda execução não duplicou observações.
    const countResult = await pool.query(
      `SELECT COUNT(*)::integer AS total
       FROM meteorological_observations
       WHERE station_id = $1`,
      [stationId],
    );

    assert.equal(countResult.rows[0].total, 2);

    // Força uma violação real de CHECK do PostgreSQL.
    // A falha ocorre depois da criação de registros dentro da transação.
    const invalidObservation = {
      ...observations[0],
      id: `invalid-${suffix}`,
      variable: "invalid_variable",
      sourceRecordId: `${stationCode}:invalid:${suffix}`,
    } as unknown as MeteorologicalObservation;

    await assert.rejects(
      persistInmetImport({
        pool,
        dataSource,
        station,
        observations: [invalidObservation],
        rawRecords: [{
          id: `${stationCode}:invalid:${suffix}`,
          sourceLine: 4,
          observedAt,
          rawPayload: { test: "rollback" },
        }],
        rawFile,
        fileName: "rollback-test.csv.gz",
        mediaType: "application/gzip",
        receivedAt,
      }),
    );

    // Confirma que o rollback removeu todos os dados da execução falha.
    const rollbackResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM ingestion_runs
          WHERE source_id = $1)::integer AS runs,
         (SELECT COUNT(*) FROM raw_files
          WHERE file_name = 'rollback-test.csv.gz'
          AND ingestion_run_id IN (
            SELECT id FROM ingestion_runs WHERE source_id = $1
          ))::integer AS files,
         (SELECT COUNT(*) FROM meteorological_observations
          WHERE id = $2)::integer AS observations`,
      [sourceId, invalidObservation.id],
    );

    assert.equal(rollbackResult.rows[0].runs, 2);
    assert.equal(rollbackResult.rows[0].files, 0);
    assert.equal(rollbackResult.rows[0].observations, 0);

    console.log("PostgreSQL real: todas as verificações passaram.");
  } finally {
    // Remove somente os registros identificados por este teste.
    await pool.query(
      "DELETE FROM meteorological_observations WHERE station_id = $1",
      [stationId],
    );

    if (successfulRunIds.length > 0) {
      await pool.query(
        "DELETE FROM raw_records WHERE ingestion_run_id = ANY($1::uuid[])",
        [successfulRunIds],
      );

      await pool.query(
        "DELETE FROM raw_files WHERE ingestion_run_id = ANY($1::uuid[])",
        [successfulRunIds],
      );

      await pool.query(
        "DELETE FROM ingestion_runs WHERE id = ANY($1::uuid[])",
        [successfulRunIds],
      );
    }

    await pool.query(
      "DELETE FROM meteorological_stations WHERE id = $1",
      [stationId],
    );

    await pool.query(
      "DELETE FROM meteorological_data_sources WHERE id = $1",
      [sourceId],
    );

    await pool.end();
  }
});
