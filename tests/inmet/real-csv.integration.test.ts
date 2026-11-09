import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { calculateDailyMeteorologicalSummaries } from "../../lib/meteorology/calculations/daily-summaries";
import { normalizeInmetCsv } from "../../lib/meteorology/providers/inmet/normalizer";
import { parseInmetHourlyCsv } from "../../lib/meteorology/providers/inmet/parser";

const RECEIVED_AT = "2026-10-30T00:00:00.000Z";
const FIXTURE_PATH = resolve(
  process.cwd(),
  "tests/fixtures/inmet/dados_A711_H_2026-10-22_2026-10-29.csv.gz.base64",
);

function loadRealCsvFixture(): string {
  const compressedBase64 = readFileSync(FIXTURE_PATH, "utf8").trim();
  return gunzipSync(Buffer.from(compressedBase64, "base64")).toString("utf8");
}

function daily(
  observations: ReturnType<typeof calculateDailyMeteorologicalSummaries>,
  date: string,
  variable: "air_temperature" | "dew_point_temperature" | "precipitation",
  statistic: "minimum" | "maximum" | "mean" | "sum",
) {
  return observations.find((observation) =>
    observation.aggregation === "daily"
    && observation.variable === variable
    && observation.statistic === statistic
    && observation.periodStart === `${date}T03:00:00.000Z`,
  );
}

test("processa o CSV real A711 e confere os resultados de referência", () => {
  const parsed = parseInmetHourlyCsv(loadRealCsvFixture());
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);

  assert.equal(parsed.station.code, "A711");
  assert.equal(parsed.station.name, "SAO CARLOS");
  assert.equal(parsed.records.length, 192);
  assert.equal(normalized.observations.length, 192 * 6);

  const negativeRadiation = normalized.observations.filter((observation) =>
    observation.variable === "solar_radiation"
    && observation.value !== null
    && observation.value < 0,
  );
  assert.equal(negativeRadiation.length, 80);
  assert.ok(negativeRadiation.every((observation) =>
    observation.quality === "suspect"
    && observation.qualityFlags.includes("outside_physical_range"),
  ));

  const result = calculateDailyMeteorologicalSummaries(normalized.observations, {
    timeZone: "America/Sao_Paulo",
    receivedAt: RECEIVED_AT,
  });

  const hourlyDewPoints = result.filter((observation) =>
    observation.variable === "dew_point_temperature"
    && observation.aggregation === "hourly",
  );
  const dailySummaries = result.filter((observation) =>
    observation.aggregation === "daily",
  );

  assert.equal(hourlyDewPoints.length, 192);
  assert.ok(hourlyDewPoints.every((observation) =>
    observation.method === "derived" && observation.quality === "valid",
  ));
assert.equal(dailySummaries.length, 9 * (2 * 3 + 1));

  const october21 = daily(
    result,
    "2026-10-21",
    "air_temperature",
    "mean",
  );
  assert.ok(october21);
  assert.equal(october21.coverage?.expectedRecords, 24);
  assert.equal(october21.coverage?.availableRecords, 3);
  assert.equal(october21.quality, "suspect");
  assert.ok(october21.qualityFlags.includes("insufficient_coverage"));
  assert.ok(Math.abs((october21.value ?? 0) - 20.6666666667) < 1e-6);

  const october22Minimum = daily(
    result,
    "2026-10-22",
    "air_temperature",
    "minimum",
  );
  const october22Maximum = daily(
    result,
    "2026-10-22",
    "air_temperature",
    "maximum",
  );
  const october22Mean = daily(
    result,
    "2026-10-22",
    "air_temperature",
    "mean",
  );
  const october22DewPointMean = daily(
    result,
    "2026-10-22",
    "dew_point_temperature",
    "mean",
  );

  const october22Precipitation = daily(
    result,
    "2026-10-22",
    "precipitation",
    "sum",
  );

  assert.ok(october22Precipitation);
  assert.equal(october22Precipitation.value, 6.6);
  assert.equal(october22Precipitation.unit, "mm");
  assert.equal(october22Precipitation.coverage?.expectedRecords, 24);
  assert.equal(october22Precipitation.coverage?.availableRecords, 24);
  assert.equal(october22Precipitation.quality, "valid");

  assert.equal(october22Minimum?.value, 15.9);
  assert.equal(october22Maximum?.value, 25);
  assert.ok(Math.abs((october22Mean?.value ?? 0) - 20.2375) < 1e-9);
  assert.ok(Math.abs((october22DewPointMean?.value ?? 0) - 15.7119970747) < 1e-6);
  assert.ok(october22Mean?.quality === "valid");
  assert.equal(october22Mean?.coverage?.completenessRatio, 1);

  const october29Mean = daily(
    result,
    "2026-10-29",
    "air_temperature",
    "mean",
  );
  assert.ok(october29Mean);
  assert.equal(october29Mean.coverage?.expectedRecords, 24);
  assert.equal(october29Mean.coverage?.availableRecords, 21);
  assert.equal(october29Mean.quality, "valid");
  assert.ok(Math.abs((october29Mean.value ?? 0) - 19.5666666667) < 1e-6);
});


test("preserva os nove resumos diários de precipitação e suas coberturas", () => {
  const parsed = parseInmetHourlyCsv(loadRealCsvFixture());
  const normalized = normalizeInmetCsv(parsed, RECEIVED_AT);
  const result = calculateDailyMeteorologicalSummaries(normalized.observations, {
    timeZone: "America/Sao_Paulo",
    receivedAt: RECEIVED_AT,
  });

  const precipitation = result
    .filter((observation) =>
      observation.variable === "precipitation"
      && observation.aggregation === "daily"
      && observation.statistic === "sum",
    )
    .sort((a, b) => a.periodStart!.localeCompare(b.periodStart!));

  assert.equal(precipitation.length, 9);
  assert.deepEqual(
    precipitation.map((observation) => observation.periodStart?.slice(0, 10)),
    [
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
    ],
  );

  const expected = [
    { date: "2026-10-21", total: 0, available: 4, quality: "suspect" },
    { date: "2026-10-22", total: 6.6, available: 24, quality: "valid" },
    { date: "2026-10-23", total: 16.4, available: 24, quality: "valid" },
    { date: "2026-10-24", total: 2.8, available: 24, quality: "valid" },
    { date: "2026-10-25", total: 79.8, available: 24, quality: "valid" },
    { date: "2026-10-26", total: 0, available: 24, quality: "valid" },
    { date: "2026-10-27", total: 0, available: 24, quality: "valid" },
    { date: "2026-10-28", total: 2.6, available: 24, quality: "valid" },
    { date: "2026-10-29", total: 20, available: 20, quality: "suspect" },
  ] as const;

  for (const expectedDay of expected) {
    const summary = precipitation.find((observation) =>
      observation.periodStart?.startsWith(expectedDay.date),
    );

    assert.ok(summary, `resumo ausente para ${expectedDay.date}`);
    assert.equal(summary.unit, "mm");
    assert.equal(summary.coverage?.expectedRecords, 24);
    assert.equal(summary.coverage?.availableRecords, expectedDay.available);
    assert.equal(summary.quality, expectedDay.quality);
    assert.ok(
      Math.abs((summary.value ?? Number.NaN) - expectedDay.total) < 1e-9,
      `total inesperado para ${expectedDay.date}`,
    );

    if (expectedDay.quality === "suspect") {
      assert.ok(summary.qualityFlags.includes("insufficient_coverage"));
    } else {
      assert.ok(!summary.qualityFlags.includes("insufficient_coverage"));
    }
  }

  const totalAcrossDailySummaries = precipitation.reduce(
    (sum, observation) => sum + (observation.value ?? 0),
    0,
  );
  assert.ok(Math.abs(totalAcrossDailySummaries - 128.2) < 1e-9);

  // O registro de 0,4 mm encerrado à meia-noite local pertence ao dia 28.
  const october28 = precipitation.find((observation) =>
    observation.periodStart?.startsWith("2026-10-28"),
  );
  const october29 = precipitation.find((observation) =>
    observation.periodStart?.startsWith("2026-10-29"),
  );
  assert.ok(october28);
  assert.ok(october29);
  assert.equal(october28.value, 2.6);
  assert.equal(october29.value, 20);
});
