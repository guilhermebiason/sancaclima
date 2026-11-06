
import assert from "node:assert/strict";
import test from "node:test";

import type { MeteorologicalObservation } from "../../types/meteorology";
import type { ObservationServiceInput } from "../../lib/meteorology/services/observation-service";

import { createDailySummariesHandler } from "../../app/api/meteorology/daily-summaries/route";
import {
  assertNoStore,
  assertStatus,
  createRequest,
  readJsonResponse,
} from "./http-test-utils";

const VALID_PARAMS = {
  stationId: "INMET:A711",
  from: "2026-10-22T03:00:00.000Z",
  to: "2026-10-23T03:00:00.000Z",
};

const SAMPLE_SUMMARY: MeteorologicalObservation = {
  id: "daily-summary-001",
  stationId: "INMET:A711",
  sourceId: "INMET",
  variable: "air_temperature",
  value: 25,
  unit: "°C",
  observedAt: "2026-10-22T12:00:00.000Z",
  receivedAt: "2026-10-22T12:05:00.000Z",
  aggregation: "daily",
  quality: "valid",
  qualityFlags: [],
};

test("GET daily-summaries: retorna resumos com HTTP 200", async () => {
  const handler = createDailySummariesHandler(async () => [
    SAMPLE_SUMMARY,
  ]);

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries", VALID_PARAMS),
  );

  const body = await readJsonResponse<{
    stationId: string;
    aggregation: string;
    count: number;
    summaries: MeteorologicalObservation[];
  }>(response);

  assertStatus(response, 200);
  assertNoStore(response);

  assert.equal(body.stationId, "INMET:A711");
  assert.equal(body.aggregation, "daily");
  assert.equal(body.count, 1);
  assert.equal(body.summaries.length, 1);
  assert.equal(body.summaries[0].aggregation, "daily");
});

test("GET daily-summaries: rejeita parâmetros obrigatórios ausentes", async () => {
  const handler = createDailySummariesHandler(async () => []);

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries"),
  );

  const body = await readJsonResponse<{
    error: string;
    required: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(body.error, "Parâmetros obrigatórios ausentes.");
  assert.ok(body.required.length > 0);
});

test("GET daily-summaries: rejeita agregação diferente de daily", async () => {
  const handler = createDailySummariesHandler(async () => []);

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries", {
      ...VALID_PARAMS,
      aggregation: "hourly",
    }),
  );

  const body = await readJsonResponse<{
    error: string;
    allowed: string[];
    received: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(
    body.error,
    "Esta rota aceita somente a agregação daily.",
  );
  assert.deepEqual(body.allowed, ["daily"]);
  assert.deepEqual(body.received, ["hourly"]);
});

test("GET daily-summaries: encaminha filtros ao serviço", async () => {
  let receivedQuery: ObservationServiceInput | undefined;

  const handler = createDailySummariesHandler(async (query) => {
    receivedQuery = query;
    return [];
  });

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries", {
      ...VALID_PARAMS,
      variable: "air_temperature",
      aggregation: "daily",
      limit: "10",
    }),
  );

  assertStatus(response, 200);

  assert.deepEqual(receivedQuery, {
    ...VALID_PARAMS,
    variables: ["air_temperature"],
    aggregations: ["daily"],
    limit: 10,
  });
});

test("GET daily-summaries: retorna HTTP 200 quando não há resultados", async () => {
  const handler = createDailySummariesHandler(async () => []);

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries", VALID_PARAMS),
  );

  const body = await readJsonResponse<{
    count: number;
    summaries: unknown[];
  }>(response);

  assertStatus(response, 200);
  assert.equal(body.count, 0);
  assert.deepEqual(body.summaries, []);
});

test("GET daily-summaries: retorna HTTP 400 para timestamps inválidos", async () => {
  const handler = createDailySummariesHandler(async () => {
    throw new Error(
      "Informe timestamps ISO 8601 válidos e um início anterior ao fim.",
    );
  });

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries", VALID_PARAMS),
  );

  const body = await readJsonResponse<{ error: string }>(response);

  assertStatus(response, 400);
  assert.match(body.error, /timestamps ISO 8601/);
});

test("GET daily-summaries: retorna HTTP 500 quando o serviço falha", async () => {
  const handler = createDailySummariesHandler(async () => {
    throw new Error("Falha simulada no banco de dados.");
  });

  const response = await handler(
    createRequest("/api/meteorology/daily-summaries", VALID_PARAMS),
  );

  const body = await readJsonResponse<{ error: string }>(response);

  assertStatus(response, 500);
  assert.equal(
    body.error,
    "Não foi possível consultar os resumos meteorológicos diários.",
  );
});
