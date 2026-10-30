import assert from "node:assert/strict";
import test from "node:test";
import type { MeteorologicalObservation } from "../../types/meteorology";
import {
  calculateDailyMeteorologicalSummaries,
  calculateDewPointCelsius,
} from "../../lib/meteorology/calculations/daily-summaries";

const RECEIVED_AT = "2026-10-30T00:00:00.000Z";

function hourlyPair(index: number, temperature: number, humidity: number): MeteorologicalObservation[] {
  const observedAt = new Date(Date.parse("2026-10-22T03:00:00.000Z") + index * 3_600_000).toISOString();
  const common = {
    stationId: "INMET:A711",
    sourceId: "inmet-bdmep",
    observedAt,
    receivedAt: RECEIVED_AT,
    aggregation: "hourly" as const,
    method: "measured" as const,
    quality: "valid" as const,
    qualityFlags: [],
  };

  return [
    {
      ...common,
      id: `temperature-${index}`,
      variable: "air_temperature",
      value: temperature,
      unit: "°C",
    },
    {
      ...common,
      id: `humidity-${index}`,
      variable: "relative_humidity",
      value: humidity,
      unit: "%",
    },
  ];
}

test("calcula ponto de orvalho pela aproximação de Magnus", () => {
  const result = calculateDewPointCelsius(20, 50);
  assert.ok(result !== null);
  assert.ok(Math.abs(result - 9.26) < 0.15);
  assert.equal(calculateDewPointCelsius(20, 0), null);
  assert.equal(calculateDewPointCelsius(20, 101), null);
});

test("gera ponto de orvalho horário e estatísticas diárias com cobertura completa", () => {
  const input = Array.from({ length: 24 }, (_, index) =>
    hourlyPair(index, 10 + index, 50),
  ).flat();

  const result = calculateDailyMeteorologicalSummaries(input, {
    receivedAt: RECEIVED_AT,
  });

  const dewPoints = result.filter((item) =>
    item.variable === "dew_point_temperature" && item.aggregation === "hourly",
  );
  const dailyTemperature = result.filter((item) =>
    item.variable === "air_temperature" && item.aggregation === "daily",
  );
  const dailyDewPoint = result.filter((item) =>
    item.variable === "dew_point_temperature" && item.aggregation === "daily",
  );

  assert.equal(dewPoints.length, 24);
  assert.ok(dewPoints.every((item) => item.method === "derived"));
  assert.equal(dailyTemperature.length, 3);
  assert.equal(dailyDewPoint.length, 3);
  assert.equal(dailyTemperature.find((item) => item.statistic === "minimum")?.value, 10);
  assert.equal(dailyTemperature.find((item) => item.statistic === "maximum")?.value, 33);
  assert.equal(dailyTemperature.find((item) => item.statistic === "mean")?.value, 21.5);
  assert.ok(dailyTemperature.every((item) => item.quality === "valid"));
  assert.ok(dailyTemperature.every((item) => item.coverage?.completenessRatio === 1));
  assert.equal(dailyTemperature[0].periodStart, "2026-10-22T03:00:00.000Z");
  assert.equal(dailyTemperature[0].periodEnd, "2026-10-23T03:00:00.000Z");
});

test("sinaliza cobertura incompleta sem ocultar a estatística calculada", () => {
  const input = Array.from({ length: 12 }, (_, index) =>
    hourlyPair(index, 15 + index, 60),
  ).flat();

  const result = calculateDailyMeteorologicalSummaries(input, {
    receivedAt: RECEIVED_AT,
  });
  const minimum = result.find((item) =>
    item.variable === "air_temperature"
    && item.aggregation === "daily"
    && item.statistic === "minimum",
  );

  assert.equal(minimum?.value, 15);
  assert.equal(minimum?.coverage?.expectedRecords, 24);
  assert.equal(minimum?.coverage?.availableRecords, 12);
  assert.equal(minimum?.quality, "suspect");
  assert.ok(minimum?.qualityFlags.includes("insufficient_coverage"));
});

test("não usa observações suspeitas para derivar ponto de orvalho", () => {
  const input = hourlyPair(0, 20, 60).map((item) =>
    item.variable === "relative_humidity"
      ? { ...item, quality: "suspect" as const }
      : item,
  );

  const result = calculateDailyMeteorologicalSummaries(input, {
    receivedAt: RECEIVED_AT,
  });

  assert.equal(result.filter((item) => item.variable === "dew_point_temperature").length, 0);
});
