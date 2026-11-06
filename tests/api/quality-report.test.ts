
import assert from "node:assert/strict";
import test from "node:test";

import {
  createQualityReportHandler,
} from "../../app/api/meteorology/quality-report/route";

import type {
  QualityReportInput,
  StationQualityReport,
} from "../../lib/meteorology/services/quality-report-service";

import {
  assertNoStore,
  assertStatus,
  createRequest,
  readJsonResponse,
} from "./http-test-utils";

const SAMPLE_REPORT: StationQualityReport = {
  stationId: "INMET:A711",
  period: {
    from: "2026-10-22T00:00:00.000Z",
    to: "2026-10-23T00:00:00.000Z",
  },
  summary: {
    total: 100,
    pending: 0,
    valid: 90,
    suspect: 8,
    invalid: 2,
  },
  percentages: {
    pending: 0,
    valid: 90,
    suspect: 8,
    invalid: 2,
  },
  byVariable: [
    {
      variable: "air_temperature",
      total: 50,
      pending: 0,
      valid: 48,
      suspect: 2,
      invalid: 0,
    },
  ],
  flags: [
    {
      flag: "outside_physical_range",
      count: 8,
      percentage: 8,
    },
  ],
};

test("GET retorna relatório de qualidade com HTTP 200", async () => {
  const handler = createQualityReportHandler(
    async () => SAMPLE_REPORT,
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
    }),
  );

  const body = await readJsonResponse<StationQualityReport & {
    filters: {
      variables: string[] | null;
      aggregations: string[] | null;
    };
  }>(response);

  assertStatus(response, 200);
  assertNoStore(response);
  assert.equal(body.stationId, "INMET:A711");
  assert.equal(body.summary.total, 100);
  assert.equal(body.summary.valid, 90);
  assert.equal(body.summary.suspect, 8);
  assert.equal(body.summary.invalid, 2);
  assert.equal(body.byVariable.length, 1);
  assert.equal(body.flags.length, 1);
  assert.deepEqual(body.filters, {
    variables: null,
    aggregations: null,
  });
});

test("GET retorna HTTP 400 quando faltam parâmetros obrigatórios", async () => {
  const handler = createQualityReportHandler(
    async () => SAMPLE_REPORT,
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
    }),
  );

  const body = await readJsonResponse<{
    error: string;
    required: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(body.error, "Parâmetros obrigatórios ausentes.");
  assert.ok(body.required);
});

test("GET rejeita agregação inválida", async () => {
  const handler = createQualityReportHandler(
    async () => SAMPLE_REPORT,
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
      aggregation: "invalid",
    }),
  );

  const body = await readJsonResponse<{
    error: string;
    allowed: string[];
    received: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(body.error, "Valor de aggregation inválido.");
  assert.deepEqual(body.received, ["invalid"]);
  assert.ok(body.allowed.includes("daily"));
});

test("GET rejeita variável meteorológica inválida", async () => {
  const handler = createQualityReportHandler(
    async () => SAMPLE_REPORT,
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
      variable: "unknown_variable",
    }),
  );

  const body = await readJsonResponse<{
    error: string;
    allowed: string[];
    received: string[];
  }>(response);

  assertStatus(response, 400);
  assert.equal(body.error, "Valor de variable inválido.");
  assert.deepEqual(body.received, ["unknown_variable"]);
  assert.ok(body.allowed.includes("air_temperature"));
});

test("GET encaminha corretamente os filtros ao serviço", async () => {
  let receivedQuery: QualityReportInput | undefined;

  const handler = createQualityReportHandler(
    async (query) => {
      receivedQuery = query;
      return SAMPLE_REPORT;
    },
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
      variable: ["air_temperature", "dew_point_temperature"],
      aggregation: ["hourly", "daily"],
    }),
  );

  const body = await readJsonResponse<{
    filters: {
      variables: string[];
      aggregations: string[];
    };
  }>(response);

  assertStatus(response, 200);

  assert.deepEqual(receivedQuery, {
    stationId: "INMET:A711",
    from: "2026-10-22T00:00:00.000Z",
    to: "2026-10-23T00:00:00.000Z",
    variables: ["air_temperature", "dew_point_temperature"],
    aggregations: ["hourly", "daily"],
  });

  assert.deepEqual(body.filters, {
    variables: ["air_temperature", "dew_point_temperature"],
    aggregations: ["hourly", "daily"],
  });
});

test("GET retorna relatório vazio com HTTP 200", async () => {
  const emptyReport: StationQualityReport = {
    stationId: "INMET:A711",
    period: {
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
    },
    summary: {
      total: 0,
      pending: 0,
      valid: 0,
      suspect: 0,
      invalid: 0,
    },
    percentages: {
      pending: 0,
      valid: 0,
      suspect: 0,
      invalid: 0,
    },
    byVariable: [],
    flags: [],
  };

  const handler = createQualityReportHandler(
    async () => emptyReport,
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
    }),
  );

  const body = await readJsonResponse<StationQualityReport>(response);

  assertStatus(response, 200);
  assert.equal(body.summary.total, 0);
  assert.equal(body.percentages.valid, 0);
  assert.deepEqual(body.byVariable, []);
  assert.deepEqual(body.flags, []);
});

test("GET retorna HTTP 400 quando o serviço rejeita timestamps", async () => {
  const handler = createQualityReportHandler(
    async () => {
      throw new Error(
        "Informe timestamps ISO 8601 válidos e um início anterior ao fim.",
      );
    },
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
    }),
  );

  const body = await readJsonResponse<{ error: string }>(response);

  assertStatus(response, 400);
  assert.ok(body.error.includes("timestamps ISO 8601"));
});

test("GET retorna HTTP 500 quando o serviço falha", async () => {
  const handler = createQualityReportHandler(
    async () => {
      throw new Error("Falha simulada no banco de dados");
    },
  );

  const response = await handler(
    createRequest("/api/meteorology/quality-report", {
      stationId: "INMET:A711",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-23T00:00:00.000Z",
    }),
  );

  const body = await readJsonResponse<{ error: string }>(response);

  assertStatus(response, 500);
  assert.equal(
    body.error,
    "Não foi possível gerar o relatório de qualidade meteorológica.",
  );
});
