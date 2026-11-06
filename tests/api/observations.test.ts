import {
  assertNoStore,
  assertStatus,
  createRequest,
  readJsonResponse,
} from "./http-test-utils";

import assert from "node:assert/strict";
import test from "node:test";

import type { MeteorologicalObservation } from "../../types/meteorology";
import type { ObservationServiceInput } from "../../lib/meteorology/services/observation-service";

import { createObservationsHandler } from "../../app/api/meteorology/observations/route";

const VALID_PARAMS = {
  stationId: "INMET:A711",
  from: "2026-10-22T03:00:00.000Z",
  to: "2026-10-23T03:00:00.000Z",
};

const SAMPLE_OBSERVATION: MeteorologicalObservation = {
  id: "observation-001",
  stationId: "INMET:A711",
  sourceId: "INMET",
  variable: "air_temperature",
  value: 25,
  unit: "°C",
  observedAt: "2026-10-22T12:00:00.000Z",
  receivedAt: "2026-10-22T12:05:00.000Z",
  aggregation: "hourly",
  quality: "valid",
  qualityFlags: [],
};

test("GET observations: retorna observações com HTTP 200", async () => {
  const handler = createObservationsHandler(async () => [
    SAMPLE_OBSERVATION,
  ]);

  const response = await handler(
    createRequest("/api/meteorology/observations", VALID_PARAMS),
  );

  const body = await readJsonResponse<{
    stationId: string;
    count: number;
    observations: typeof SAMPLE_OBSERVATION[];
  }>(response);

  assertStatus(response, 200);
  assertNoStore(response);

  assert.equal(body.stationId, "INMET:A711");
  assert.equal(body.count, 1);
  assert.equal(body.observations.length, 1);
  assert.equal(body.observations[0].value, 25);
});

test("GET observations: rejeita parâmetros obrigatórios ausentes", async () => {
  const handler = createObservationsHandler(async () => []);

  const response = await handler(
    createRequest("/api/meteorology/observations"),
  );

  const body = await readJsonResponse<{
    error: string;
    required: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(body.error, "Parâmetros obrigatórios ausentes.");
  assert.ok(body.required.length > 0);
});

test("GET observations: rejeita agregação inválida", async () => {
  const handler = createObservationsHandler(async () => []);

  const response = await handler(
    createRequest("/api/meteorology/observations", {
      ...VALID_PARAMS,
      aggregation: "monthly",
    }),
  );

  const body = await readJsonResponse<{
    error: string;
    allowed: string[];
    received: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(body.error, "Valor de aggregation inválido.");
  assert.ok(body.allowed.includes("hourly"));
  assert.deepEqual(body.received, ["monthly"]);
});

test("GET observations: encaminha filtros ao serviço", async () => {
  let receivedQuery: ObservationServiceInput | undefined;
  const handler = createObservationsHandler(async (query) => {
    receivedQuery = query;
    return [];
  });

  const response = await handler(
    createRequest("/api/meteorology/observations", {
      ...VALID_PARAMS,
      variable: "air_temperature",
      aggregation: "hourly",
      limit: "10",
    }),
  );

  assertStatus(response, 200);

  assert.deepEqual(receivedQuery, {
    ...VALID_PARAMS,
    variables: ["air_temperature"],
    aggregations: ["hourly"],
    limit: 10,
  });
});

test("GET observations: retorna HTTP 200 quando não há resultados", async () => {
  const handler = createObservationsHandler(async () => []);

  const response = await handler(
    createRequest("/api/meteorology/observations", VALID_PARAMS),
  );

  const body = await readJsonResponse<{
    count: number;
    observations: unknown[];
  }>(response);

  assertStatus(response, 200);
  assert.equal(body.count, 0);
  assert.deepEqual(body.observations, []);
});

test("GET observations: retorna HTTP 400 para timestamps inválidos", async () => {
  const handler = createObservationsHandler(async () => {
    throw new Error(
      "Informe timestamps ISO 8601 válidos e um início anterior ao fim.",
    );
  });

  const response = await handler(
    createRequest("/api/meteorology/observations", VALID_PARAMS),
  );

  const body = await readJsonResponse<{ error: string }>(response);

  assertStatus(response, 400);
  assert.match(body.error, /timestamps ISO 8601/);
});

test("GET observations: retorna HTTP 500 quando o serviço falha", async () => {
  const handler = createObservationsHandler(async () => {
    throw new Error("Falha simulada no banco de dados.");
  });

  const response = await handler(
    createRequest("/api/meteorology/observations", VALID_PARAMS),
  );

  const body = await readJsonResponse<{ error: string }>(response);

  assertStatus(response, 500);
  assert.equal(
    body.error,
    "Não foi possível consultar as observações meteorológicas.",
  );
});
