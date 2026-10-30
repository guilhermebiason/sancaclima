import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { calculateDailyMeteorologicalSummaries } from "../../lib/meteorology/calculations/daily-summaries";
import { normalizeInmetCsv } from "../../lib/meteorology/providers/inmet/normalizer";
import { parseInmetHourlyCsv } from "../../lib/meteorology/providers/inmet/parser";
import { persistInmetImport } from "../../lib/meteorology/persistence/postgres-repository";

const RECEIVED_AT = "2026-10-30T00:00:00.000Z";
const FIXTURE_PATH = resolve(
  process.cwd(),
  "tests/fixtures/inmet/dados_A711_H_2026-10-22_2026-10-29.csv.gz.base64",
);

function loadFixture(): { csv: string; bytes: Buffer } {
  const compressed = readFileSync(FIXTURE_PATH, "utf8").trim();
  const bytes = gunzipSync(Buffer.from(compressed, "base64"));
  return { csv: bytes.toString("utf8"), bytes };
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
    id: `${normalized.station.id}:${record.observedAt}`,
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
    fileName: "dados_A711_H_2026-10-22_2026-10-29.csv",
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

  const negativeRadiation = normalized.observations.find((observation) =>
    observation.variable === "solar_radiation" && (observation.value ?? 0) < 0,
  );
  assert.ok(negativeRadiation);
  assert.ok(persistedValues.includes(negativeRadiation.value));
  assert.ok(persistedValues.includes("suspect"));
  assert.ok(persistedValues.some((value) =>
    Array.isArray(value) && value.includes("outside_physical_range"),
  ));
  assert.ok(persistedValues.includes(`${result.ingestionRunId}:INMET:A711:2026-10-22T03:00:00.000Z`));
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
        id: `${normalized.station.id}:${record.observedAt}`,
        sourceLine: record.sourceLine,
        observedAt: record.observedAt,
        rawPayload: record.values as unknown as Record<string, unknown>,
      })),
      rawFile: bytes,
      fileName: "dados_A711_H_2026-10-22_2026-10-29.csv",
      receivedAt: RECEIVED_AT,
    }),
    /simulated database failure/,
  );

  assert.ok(fake.calls.some((call) => call.sql === "ROLLBACK"));
});
