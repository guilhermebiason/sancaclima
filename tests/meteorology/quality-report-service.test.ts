import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import {
  getStationQualityStatistics,
} from "../../lib/meteorology/services/quality-report-service";

function createFakePool() {
  const calls: Array<{
    text: string;
    values?: unknown[];
  }> = [];

  const pool = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });

      if (text.includes("CROSS JOIN LATERAL")) {
        return {
          rows: [
            { flag: "outside_physical_range", count: 2 },
            { flag: "source_warning", count: 1 },
          ],
        };
      }

      if (text.includes("GROUP BY observations.variable")) {
        return {
          rows: [
            {
              variable: "air_temperature",
              quality: "valid",
              count: 8,
            },
            {
              variable: "air_temperature",
              quality: "suspect",
              count: 2,
            },
            {
              variable: "relative_humidity",
              quality: "valid",
              count: 10,
            },
          ],
        };
      }

      return {
        rows: [
          { quality: "pending", count: 0 },
          { quality: "valid", count: 18 },
          { quality: "suspect", count: 2 },
          { quality: "invalid", count: 0 },
        ],
      };
    },
  } as unknown as Pool;

  return { pool, calls };
}

const input = {
  stationId: "INMET:A711",
  from: "2026-10-22T00:00:00.000Z",
  to: "2026-10-23T00:00:00.000Z",
};

test("consolida os estados de qualidade e seus percentuais", async () => {
  const { pool } = createFakePool();

  const report = await getStationQualityStatistics(pool, input);

  assert.equal(report.summary.total, 20);
  assert.equal(report.summary.pending, 0);
  assert.equal(report.summary.valid, 18);
  assert.equal(report.summary.suspect, 2);
  assert.equal(report.summary.invalid, 0);

  assert.equal(report.percentages.valid, 90);
  assert.equal(report.percentages.suspect, 10);
  assert.equal(report.percentages.pending, 0);
  assert.equal(report.percentages.invalid, 0);
});

test("consolida a qualidade por variável meteorológica", async () => {
  const { pool } = createFakePool();

  const report = await getStationQualityStatistics(pool, input);

  assert.deepEqual(report.byVariable, [
    {
      variable: "air_temperature",
      total: 10,
      pending: 0,
      valid: 8,
      suspect: 2,
      invalid: 0,
    },
    {
      variable: "relative_humidity",
      total: 10,
      pending: 0,
      valid: 10,
      suspect: 0,
      invalid: 0,
    },
  ]);
});

test("contabiliza sinalizações de qualidade", async () => {
  const { pool } = createFakePool();

  const report = await getStationQualityStatistics(pool, input);

  assert.deepEqual(report.flags, [
    {
      flag: "outside_physical_range",
      count: 2,
      percentage: 10,
    },
    {
      flag: "source_warning",
      count: 1,
      percentage: 5,
    },
  ]);
});

test("aplica filtros de variável e agregação nas três consultas", async () => {
  const { pool, calls } = createFakePool();

  await getStationQualityStatistics(pool, {
    ...input,
    variables: ["air_temperature"],
    aggregations: ["hourly"],
  });

  assert.equal(calls.length, 3);

  for (const call of calls) {
    assert.match(
      call.text,
      /observations\.variable = ANY\(\$4::text\[\]\)/,
    );

    assert.match(
      call.text,
      /observations\.aggregation = ANY\(\$5::text\[\]\)/,
    );

    assert.deepEqual(call.values, [
      "INMET:A711",
      input.from,
      input.to,
      ["air_temperature"],
      ["hourly"],
    ]);
  }
});

test("rejeita intervalo de datas inválido", async () => {
  const { pool, calls } = createFakePool();

  await assert.rejects(
    getStationQualityStatistics(pool, {
      ...input,
      from: "data-invalida",
    }),
    /timestamps ISO 8601 válidos/,
  );

  assert.equal(calls.length, 0);
});