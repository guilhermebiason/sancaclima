import assert from "node:assert/strict";
import test from "node:test";

import type { MeteorologicalObservation } from "../../types/meteorology";
import { applyInmetQualityControl } from "../../lib/meteorology/providers/inmet/quality-control";

function createObservation(
  overrides: Partial<MeteorologicalObservation> = {},
): MeteorologicalObservation {
  return {
    id: "observation-1",
    stationId: "INMET:A711",
    sourceId: "inmet-bdmep",
    variable: "air_temperature",
    value: 21.7,
    unit: "°C",
    observedAt: "2026-10-22T12:00:00.000Z",
    receivedAt: "2026-10-22T13:00:00.000Z",
    aggregation: "hourly",
    method: "measured",
    quality: "valid",
    qualityFlags: [],
    ...overrides,
  };
}

test("preserva valores nos limites físicos permitidos", () => {
  const observations = [
    createObservation({ id: "minimum", value: -90, observedAt: "2026-10-22T12:00:00.000Z" }),
    createObservation({ id: "maximum", value: 60, observedAt: "2026-10-22T13:00:00.000Z" }),
  ];

  const result = applyInmetQualityControl(observations);

  assert.ok(result.every((item) => item.quality === "valid"));
  assert.ok(result.every(
    (item) => !item.qualityFlags.includes("outside_physical_range"),
  ));
});

test("promove observações pending para valid quando não há problemas", () => {
  const observation = createObservation({
    quality: "pending",
    qualityFlags: [],
  });

  const result = applyInmetQualityControl([observation]);

  assert.equal(result[0].quality, "valid");
  assert.deepEqual(result[0].qualityFlags, []);
});

test("sinaliza valores fora dos limites físicos sem modificá-los", () => {
  const observation = createObservation({
    variable: "solar_radiation",
    value: -3.5,
    unit: "kJ/m²",
  });

  const result = applyInmetQualityControl([observation]);

  assert.equal(result[0].value, -3.5);
  assert.equal(result[0].quality, "suspect");
  assert.ok(result[0].qualityFlags.includes("outside_physical_range"));
});

test("classifica valores ausentes como inválidos", () => {
  const observation = createObservation({
    value: null,
  });

  const result = applyInmetQualityControl([observation]);

  assert.equal(result[0].value, null);
  assert.equal(result[0].quality, "invalid");
  assert.ok(result[0].qualityFlags.includes("missing_value"));
});

test("identifica duplicatas sem remover observações", () => {
  const observations = [
    createObservation({ id: "duplicate-1" }),
    createObservation({ id: "duplicate-2" }),
  ];

  const result = applyInmetQualityControl(observations);

  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.quality === "suspect"));
  assert.ok(result.every((item) => item.qualityFlags.includes("duplicate")));
});

test("identifica timestamps fora de ordem dentro da mesma estação", () => {
  const observations = [
    createObservation({
      id: "later",
      observedAt: "2026-10-22T13:00:00.000Z",
    }),
    createObservation({
      id: "earlier",
      observedAt: "2026-10-22T12:00:00.000Z",
    }),
  ];

  const result = applyInmetQualityControl(observations);

  assert.ok(
    result[1].qualityFlags.includes("timestamp_out_of_order"),
  );
  assert.equal(result[1].quality, "suspect");
});

test("não mistura a ordem temporal de estações diferentes", () => {
  const observations = [
    createObservation({
      id: "station-a",
      stationId: "INMET:A711",
      observedAt: "2026-10-22T13:00:00.000Z",
    }),
    createObservation({
      id: "station-b",
      stationId: "INMET:B123",
      observedAt: "2026-10-22T12:00:00.000Z",
    }),
  ];

  const result = applyInmetQualityControl(observations);

  assert.ok(
    !result[1].qualityFlags.includes("timestamp_out_of_order"),
  );
});

test("preserva o estado invalid de uma observação com valor não nulo", () => {
  const observation = createObservation({
    value: 21.7,
    quality: "invalid",
    qualityFlags: ["source_warning"],
  });

  const result = applyInmetQualityControl([observation]);

  assert.equal(result[0].quality, "invalid");
  assert.ok(result[0].qualityFlags.includes("source_warning"));
});

test("pode ser executado repetidamente sem acumular flags duplicadas", () => {
  const observations = [
    createObservation({
      id: "first",
      variable: "solar_radiation",
      value: -3.5,
    }),
    createObservation({
      id: "second",
      variable: "solar_radiation",
      value: -3.5,
    }),
  ];

  const firstResult = applyInmetQualityControl(observations);
  const secondResult = applyInmetQualityControl(firstResult);

  assert.deepEqual(secondResult, firstResult);

  for (const observation of secondResult) {
    assert.equal(
      observation.qualityFlags.length,
      new Set(observation.qualityFlags).size,
    );
  }
});
