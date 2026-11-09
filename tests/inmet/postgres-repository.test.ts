import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { calculateDailyMeteorologicalSummaries } from "../../lib/meteorology/calculations/daily-summaries";
import { normalizeInmetCsv } from "../../lib/meteorology/providers/inmet/normalizer";
import { parseInmetHourlyCsv } from "../../lib/meteorology/providers/inmet/parser";
import {
  persistDerivedObservations,
  persistInmetImport,
} from "../../lib/meteorology/persistence/postgres-repository";



const RECEIVED_AT = "2026-10-30T00:00:00.000Z";
const FIXTURE_PATH = resolve(
  process.cwd(),
  "tests/fixtures/inmet/dados_A711_H_2026-10-22_2026-10-29.csv.gz.base64",
);

function loadFixture(): { csv: string; bytes: Buffer } {
  const compressed = readFileSync(FIXTURE_PATH, "utf8").trim();
  const bytes = Buffer.from(compressed, "base64");
  return { csv: gunzipSync(bytes).toString("utf8"), bytes };
}

function createFakePool() {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0 };
    },
    release: () => { released = true; },
  };
  const pool = {
    connect: async () => client,
  };
  return {
    pool: pool as unknown as Pool,
    client: client as unknown as PoolClient,
    calls,
    wasReleased: () => released,
  };
}

test("persiste o CSV A711 em uma transação e prepara observações sem perda", async () => {
  const { csv, bytes } = loadFixture();
  const parsed = parseInmetHourlyCsv(csv);
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);
  const derived = calculateDailyMeteorologicalSummaries(normalized.observations, {
    timeZone: "America/Sao_Paulo",
    receivedAt: RECEIVED_AT,
  });
  const rawRecords = parsed.records.map((record) => ({
    id: `${parsed.station.code}:${record.observedAt}:line-${record.sourceLine}`,
    sourceLine: record.sourceLine,
    observedAt: record.observedAt,
    rawPayload: record.values as unknown as Record<string, unknown>,
  }));
  const fake = createFakePool();

  const result = await persistInmetImport({
    pool: fake.pool,
    dataSource: normalized.dataSource,
    station: normalized.station,
    observations: [...normalized.observations, ...derived],
    rawRecords,
    rawFile: bytes,
    fileName: "dados_A711_H_2026-10-22_2026-10-29.csv.gz",
    mediaType: "application/gzip",
    receivedAt: RECEIVED_AT,
  });

  assert.equal(result.rawRecordCount, 192);
  assert.equal(result.observationCount, 192 * 6 + derived.length);
  assert.equal(result.rawFileSha256.length, 64);
  assert.ok(fake.wasReleased());
  assert.equal(fake.calls[0].sql, "BEGIN");
  assert.equal(fake.calls[fake.calls.length - 1]?.sql, "COMMIT");
  assert.equal(fake.calls.filter((call) => call.sql.includes("INSERT INTO raw_records")).length, 1);

  const observationBatches = fake.calls.filter((call) =>
    call.sql.includes("INSERT INTO meteorological_observations"),
  );
  assert.ok(observationBatches.length >= 1);
  const persistedValues = observationBatches.flatMap((call) => call.values ?? []);
  assert.equal(persistedValues.length, result.observationCount * 21);

  const rawFileInsert = fake.calls.find((call) => call.sql.includes("INSERT INTO raw_files"));
  assert.ok(rawFileInsert);
  assert.equal(rawFileInsert.values?.[3], "application/gzip");
  assert.deepEqual(rawFileInsert.values?.[6], bytes);

  const negativeRadiation = normalized.observations.find((observation) =>
    observation.variable === "solar_radiation" && (observation.value ?? 0) < 0,
  );
  assert.ok(negativeRadiation);
  assert.ok(persistedValues.includes(negativeRadiation.value));
  assert.ok(persistedValues.includes("suspect"));
  assert.ok(persistedValues.some((value) =>
    Array.isArray(value) && value.includes("outside_physical_range"),
  ));
  const sourceRecord = parsed.records.find(
    (record) => record.observedAt === "2026-10-22T03:00:00.000Z",
  );
  assert.ok(sourceRecord);
  const expectedRawRecordId = `${result.ingestionRunId}:A711:${sourceRecord.observedAt}:line-${sourceRecord.sourceLine}`;
  assert.ok(persistedValues.includes(expectedRawRecordId));
});


test("mantém linhas brutas distintas quando o CSV repete o mesmo horário", async () => {
  const { csv } = loadFixture();
  const lines = csv.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("Data Medicao;"));
  assert.ok(headerIndex >= 0);
  const firstRecord = lines[headerIndex + 1];
  const duplicatedCsv = [
    ...lines.slice(0, headerIndex + 1),
    firstRecord,
    firstRecord,
    ...lines.slice(headerIndex + 2),
  ].join("\n");

  const duplicatedRawFile = gzipSync(Buffer.from(duplicatedCsv, "utf8"));
  const parsed = parseInmetHourlyCsv(duplicatedCsv);
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);
  const firstTimestamp = parsed.records[0].observedAt;
  const duplicateRows = parsed.records.filter((record) => record.observedAt === firstTimestamp);
  assert.equal(duplicateRows.length, 2);

  // Uma variável inválida em uma das linhas não pode rejeitar a outra
  // linha que compartilha o mesmo timestamp.
  const invalidSourceRecordId = `${parsed.station.code}:${firstTimestamp}:line-${duplicateRows[0].sourceLine}:solar_radiation`;
  const observationsWithOneInvalidValue = normalized.observations.map((observation) =>
    observation.sourceRecordId === invalidSourceRecordId
      ? { ...observation, quality: "invalid" as const }
      : observation,
  );

  const rawRecords = parsed.records.map((record) => ({
    id: `${parsed.station.code}:${record.observedAt}:line-${record.sourceLine}`,
    sourceLine: record.sourceLine,
    observedAt: record.observedAt,
    rawPayload: record.values as unknown as Record<string, unknown>,
  }));
  assert.equal(new Set(rawRecords.map((record) => record.id)).size, parsed.records.length);

  const fake = createFakePool();
  await persistInmetImport({
    pool: fake.pool,
    dataSource: normalized.dataSource,
    station: normalized.station,
    observations: observationsWithOneInvalidValue,
    rawRecords,
    rawFile: duplicatedRawFile,
    fileName: "duplicated-source.csv.gz",
    mediaType: "application/gzip",
    receivedAt: RECEIVED_AT,
  });

  const rawInsert = fake.calls.find((call) => call.sql.includes("INSERT INTO raw_records"));
  assert.ok(rawInsert);
  const rawIds = (rawInsert.values ?? []).filter((_, index) => index % 6 === 0);
  assert.equal(rawIds.length, parsed.records.length);
  assert.equal(new Set(rawIds).size, parsed.records.length);

  const observationInsert = fake.calls.find((call) => call.sql.includes("INSERT INTO meteorological_observations"));
  assert.ok(observationInsert);
  const params = observationInsert.values ?? [];
  const linkedIds = new Set<string>();
  for (let offset = 0; offset < params.length; offset += 21) {
    if (params[offset + 7] === firstTimestamp && typeof params[offset + 19] === "string") {
      linkedIds.add(params[offset + 19] as string);
    }
  }
  assert.equal(linkedIds.size, 2);

  const ingestionUpdate = fake.calls.find((call) =>
    call.sql.includes("UPDATE ingestion_runs"),
  );
  assert.ok(ingestionUpdate);
  assert.equal(ingestionUpdate.values?.[2], "partially_succeeded");
  assert.equal(ingestionUpdate.values?.[3], parsed.records.length - 1);
  assert.equal(ingestionUpdate.values?.[4], 1);
});

test("faz rollback e libera a conexão quando uma gravação falha", async () => {
  const { csv, bytes } = loadFixture();
  const parsed = parseInmetHourlyCsv(csv);
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);
  const fake = createFakePool();
  const failingClient = {
    query: async (sql: string, values?: unknown[]) => {
      fake.calls.push({ sql, values });
      if (sql.includes("INSERT INTO raw_files")) throw new Error("simulated database failure");
      return { rows: [], rowCount: 0 };
    },
    release: () => { fake.client.release(); },
  };
  const pool = { connect: async () => failingClient } as unknown as Pool;

  await assert.rejects(
    persistInmetImport({
      pool,
      dataSource: normalized.dataSource,
      station: normalized.station,
      observations: normalized.observations,
      rawRecords: parsed.records.map((record) => ({
        id: `${parsed.station.code}:${record.observedAt}:line-${record.sourceLine}`,
        sourceLine: record.sourceLine,
        observedAt: record.observedAt,
        rawPayload: record.values as unknown as Record<string, unknown>,
      })),
      rawFile: bytes,
      fileName: "dados_A711_H_2026-10-22_2026-10-29.csv.gz",
      mediaType: "application/gzip",
      receivedAt: RECEIVED_AT,
    }),
    /simulated database failure/,
  );

  assert.ok(fake.calls.some((call) => call.sql === "ROLLBACK"));
});

test("persiste observações derivadas sem criar novos registros brutos", async () => {
  const { csv } = loadFixture();
  const parsed = parseInmetHourlyCsv(csv);
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);

  const derived = calculateDailyMeteorologicalSummaries(
    normalized.observations,
    {
      timeZone: "America/Sao_Paulo",
      receivedAt: RECEIVED_AT,
    },
  );

  assert.ok(derived.length > 0);
  assert.ok(
    derived.every(
      (observation) =>
        observation.method === "calculated" ||
        observation.method === "derived",
    ),
  );

  const precipitationSummaries = derived.filter(
    (observation) =>
      observation.variable === "precipitation" &&
      observation.aggregation === "daily",
  );

  assert.equal(precipitationSummaries.length, 9);

  const fake = createFakePool();

  const persistedCount = await persistDerivedObservations(
    fake.pool,
    derived,
  );

  assert.equal(persistedCount, derived.length);
  assert.ok(fake.wasReleased());

  assert.equal(fake.calls[0].sql, "BEGIN");
  assert.equal(fake.calls[fake.calls.length - 1]?.sql, "COMMIT");

  const inserts = fake.calls.filter((call) =>
    call.sql.includes("INSERT INTO meteorological_observations"),
  );

  assert.ok(inserts.length > 0);

  const allSql = fake.calls.map((call) => call.sql).join("\n");

  assert.ok(!allSql.includes("INSERT INTO raw_files"));
  assert.ok(!allSql.includes("INSERT INTO raw_records"));
  assert.ok(!allSql.includes("INSERT INTO ingestion_runs"));

  const persistedValues = inserts.flatMap(
    (call) => call.values ?? [],
  );

  assert.ok(persistedValues.includes("calculated"));
  assert.ok(persistedValues.includes("precipitation"));
});

test("rejeita observações medidas na persistência derivada", async () => {
  const fake = createFakePool();

  await assert.rejects(
    persistDerivedObservations(fake.pool, [
      {
        id: "test-measured-observation",
        stationId: "INMET:A711",
        sourceId: "inmet-bdmep",
        variable: "air_temperature",
        value: 25,
        unit: "°C",
        observedAt: RECEIVED_AT,
        receivedAt: RECEIVED_AT,
        aggregation: "hourly",
        method: "measured",
        quality: "valid",
        qualityFlags: [],
      },
    ]),
    /não é calculada ou derivada/,
  );

  assert.equal(fake.calls.length, 0);
  assert.equal(fake.wasReleased(), false);
});

test("faz rollback e libera a conexão quando a persistência derivada falha", async () => {
  const { csv } = loadFixture();
  const parsed = parseInmetHourlyCsv(csv);
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);

  const derived = calculateDailyMeteorologicalSummaries(
    normalized.observations,
    {
      timeZone: "America/Sao_Paulo",
      receivedAt: RECEIVED_AT,
    },
  );

  const fake = createFakePool();

  const failingClient = {
    query: async (sql: string, values?: unknown[]) => {
      fake.calls.push({ sql, values });

      if (sql.includes("INSERT INTO meteorological_observations")) {
        throw new Error("simulated derived persistence failure");
      }

      return { rows: [], rowCount: 0 };
    },
    release: () => {
      fake.client.release();
    },
  };

  const pool = {
    connect: async () => failingClient,
  } as unknown as Pool;

  await assert.rejects(
    persistDerivedObservations(pool, derived),
    /simulated derived persistence failure/,
  );

  assert.ok(fake.calls.some((call) => call.sql === "ROLLBACK"));
  assert.ok(fake.wasReleased());
});
