import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import {
  getStationObservations,
  getDailySummaries,
  getStationQualityReport,
} from "../../lib/meteorology/services/observation-service";

function createFakePool() {
  const calls: Array<{
    text: string;
    values?: unknown[];
  }> = [];

  const pool = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      return { rows: [] };
    },
  } as unknown as Pool;

  return { pool, calls };
}

const input = {
  stationId: "INMET:A711",
  from: "2026-10-22T00:00:00.000Z",
  to: "2026-10-23T00:00:00.000Z",
  variables: ["air_temperature"],
};

test("consulta observações da estação com filtro de variável", async () => {
  const { pool, calls } = createFakePool();

  const result = await getStationObservations(pool, input);

  assert.deepEqual(result, []);
  assert.equal(calls.length, 1);

  assert.match(calls[0].text, /variable = ANY\(\$4::text\[\]\)/);

  assert.deepEqual(calls[0].values, [
    "INMET:A711",
    input.from,
    input.to,
    ["air_temperature"],
    5000,
  ]);
});

test("consulta somente estatísticas diárias", async () => {
  const { pool, calls } = createFakePool();

  const result = await getDailySummaries(pool, input);

  assert.deepEqual(result, []);
  assert.equal(calls.length, 1);

  assert.match(calls[0].text, /aggregation = ANY\(\$5::text\[\]\)/);
  assert.match(calls[0].text, /aggregation = 'daily'/);
  assert.match(calls[0].text, /period_start < \$3/);
  assert.match(calls[0].text, /period_end > \$2/);
  assert.match(calls[0].text, /aggregation <> 'daily'/);
  assert.match(calls[0].text, /observed_at >= \$2/);
  assert.match(calls[0].text, /observed_at < \$3/);

  assert.deepEqual(calls[0].values, [
    "INMET:A711",
    input.from,
    input.to,
    ["air_temperature"],
    ["daily"],
    5000,
  ]);
});

test("consulta observações suspeitas e inválidas", async () => {
  const { pool, calls } = createFakePool();

  const result = await getStationQualityReport(pool, input);

  assert.deepEqual(result, []);
  assert.equal(calls.length, 1);

  assert.match(calls[0].text, /quality = ANY\(\$5::text\[\]\)/);

  assert.deepEqual(calls[0].values, [
    "INMET:A711",
    input.from,
    input.to,
    ["air_temperature"],
    ["suspect", "invalid"],
    5000,
  ]);
});