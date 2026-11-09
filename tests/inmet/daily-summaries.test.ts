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


test("considera suficiente a cobertura exatamente no limite de 75%", () => {
  const input = Array.from({ length: 18 }, (_, index) =>
    hourlyPair(index, 15 + index, 60),
  ).flat();

  const result = calculateDailyMeteorologicalSummaries(input, {
    receivedAt: RECEIVED_AT,
  });

  const dailyTemperature = result.filter((item) =>
    item.variable === "air_temperature"
    && item.aggregation === "daily",
  );

  assert.equal(dailyTemperature.length, 3);
  assert.ok(dailyTemperature.every(
    (item) => item.coverage?.completenessRatio === 0.75,
  ));
  const minimum = dailyTemperature.find((item) => item.statistic === "minimum");
  const maximum = dailyTemperature.find((item) => item.statistic === "maximum");
  const mean = dailyTemperature.find((item) => item.statistic === "mean");

  assert.equal(minimum?.quality, "suspect");
  assert.equal(maximum?.quality, "suspect");
  assert.equal(mean?.quality, "valid");
  assert.ok(minimum?.qualityFlags.includes("insufficient_coverage"));
  assert.ok(maximum?.qualityFlags.includes("insufficient_coverage"));
  assert.ok(!mean?.qualityFlags.includes("insufficient_coverage"));
});

test("considera suficiente a cobertura de 87,5%", () => {
  const input = Array.from({ length: 21 }, (_, index) =>
    hourlyPair(index, 15 + index, 60),
  ).flat();

  const result = calculateDailyMeteorologicalSummaries(input, {
    receivedAt: RECEIVED_AT,
  });

  const dailyTemperature = result.filter((item) =>
    item.variable === "air_temperature"
    && item.aggregation === "daily",
  );

  assert.equal(dailyTemperature.length, 3);
  assert.ok(dailyTemperature.every(
    (item) => item.coverage?.completenessRatio === 0.875,
  ));
  const minimum = dailyTemperature.find((item) => item.statistic === "minimum");
  const maximum = dailyTemperature.find((item) => item.statistic === "maximum");
  const mean = dailyTemperature.find((item) => item.statistic === "mean");

  assert.equal(minimum?.quality, "suspect");
  assert.equal(maximum?.quality, "suspect");
  assert.equal(mean?.quality, "valid");
  assert.ok(minimum?.qualityFlags.includes("insufficient_coverage"));
  assert.ok(maximum?.qualityFlags.includes("insufficient_coverage"));
  assert.ok(!mean?.qualityFlags.includes("insufficient_coverage"));
});


test("exige cobertura completa para extremos diários de temperatura e ponto de orvalho", () => {
  const input = Array.from({ length: 23 }, (_, index) =>
    hourlyPair(index, 15 + index, 60),
  ).flat();

  const result = calculateDailyMeteorologicalSummaries(input, {
    receivedAt: RECEIVED_AT,
  });

  for (const variable of ["air_temperature", "dew_point_temperature"] as const) {
    const summaries = result.filter((item) =>
      item.variable === variable && item.aggregation === "daily",
    );
    assert.equal(summaries.length, 3);
    assert.ok(summaries
      .filter((item) => item.statistic === "minimum" || item.statistic === "maximum")
      .every((item) => item.quality === "suspect"));
    assert.equal(summaries.find((item) => item.statistic === "mean")?.quality, "valid");
    assert.ok(summaries.every((item) => item.coverage?.availableRecords === 23));
  }
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

test("atribui a precipitação encerrada à meia-noite ao dia local anterior", () => {
  const input: MeteorologicalObservation[] = [
    {
      id: "precipitation-midnight",
      stationId: "INMET:A711",
      sourceId: "inmet-bdmep",
      variable: "precipitation",
      value: 2.5,
      unit: "mm",
      observedAt: "2026-10-22T03:00:00.000Z",
      receivedAt: RECEIVED_AT,
      aggregation: "accumulated",
      method: "measured",
      quality: "valid",
      qualityFlags: [],
    },
  ];

  const result = calculateDailyMeteorologicalSummaries(input, {
    timeZone: "America/Sao_Paulo",
    receivedAt: RECEIVED_AT,
  });

  const precipitation = result.find((item) =>
    item.variable === "precipitation"
    && item.aggregation === "daily"
    && item.statistic === "sum",
  );

  assert.ok(precipitation);
  assert.equal(precipitation.value, 2.5);
  assert.equal(precipitation.unit, "mm");
  assert.equal(precipitation.periodStart, "2026-10-21T03:00:00.000Z");
  assert.equal(precipitation.periodEnd, "2026-10-22T03:00:00.000Z");
  assert.equal(precipitation.quality, "suspect");
  assert.equal(precipitation.coverage?.expectedRecords, 24);
  assert.equal(precipitation.coverage?.availableRecords, 1);
});

test("exclui precipitação suspeita da soma e da cobertura diária", () => {
  const input: MeteorologicalObservation[] = [
    {
      id: "precipitation-valid",
      stationId: "INMET:A711",
      sourceId: "inmet-bdmep",
      variable: "precipitation",
      value: 2.5,
      unit: "mm",
      observedAt: "2026-10-22T04:00:00.000Z",
      receivedAt: RECEIVED_AT,
      aggregation: "accumulated",
      method: "measured",
      quality: "valid",
      qualityFlags: [],
    },
    {
      id: "precipitation-suspect",
      stationId: "INMET:A711",
      sourceId: "inmet-bdmep",
      variable: "precipitation",
      value: 10,
      unit: "mm",
      observedAt: "2026-10-22T05:00:00.000Z",
      receivedAt: RECEIVED_AT,
      aggregation: "accumulated",
      method: "measured",
      quality: "suspect",
      qualityFlags: ["outside_physical_range"],
    },
  ];

  const result = calculateDailyMeteorologicalSummaries(input, {
    timeZone: "America/Sao_Paulo",
    receivedAt: RECEIVED_AT,
  });

  const precipitation = result.find((item) =>
    item.variable === "precipitation"
    && item.aggregation === "daily"
    && item.statistic === "sum",
  );

  assert.ok(precipitation);
  assert.equal(precipitation.value, 2.5);
  assert.equal(precipitation.coverage?.expectedRecords, 24);
  assert.equal(precipitation.coverage?.availableRecords, 1);
  assert.equal(precipitation.quality, "suspect");
  assert.ok(precipitation.qualityFlags.includes("insufficient_coverage"));
});
