import assert from "node:assert/strict";
import test from "node:test";

import { validateObservationQuery } from "../../lib/meteorology/services/query-validation";

test("rejeita parâmetros obrigatórios ausentes", () => {
  const params = new URLSearchParams();

  const result = validateObservationQuery(params);

  assert.equal(result.valid, false);
  assert.equal(
    result.error?.message,
    "Parâmetros obrigatórios ausentes.",
  );
});

test("aceita uma consulta com parâmetros obrigatórios", () => {
  const params = new URLSearchParams({
    stationId: "INMET:A711",
    from: "2026-10-22T00:00:00.000Z",
    to: "2026-10-23T00:00:00.000Z",
  });

  const result = validateObservationQuery(params);

  assert.equal(result.valid, true);
  assert.equal(result.data?.stationId, "INMET:A711");
  assert.equal(result.data?.variables, undefined);
  assert.equal(result.data?.aggregations, undefined);
});

test("aceita filtros de variáveis e agregações", () => {
  const params = new URLSearchParams(
    "stationId=INMET%3AA711&from=2026-10-22T00%3A00%3A00.000Z&to=2026-10-23T00%3A00%3A00.000Z&variable=air_temperature&aggregation=hourly&aggregation=daily",
  );

  const result = validateObservationQuery(params);

  assert.equal(result.valid, true);
  assert.deepEqual(result.data?.variables, ["air_temperature"]);
  assert.deepEqual(result.data?.aggregations, ["hourly", "daily"]);
});

test("rejeita agregações inválidas", () => {
  const params = new URLSearchParams({
    stationId: "INMET:A711",
    from: "2026-10-22T00:00:00.000Z",
    to: "2026-10-23T00:00:00.000Z",
    aggregation: "monthly",
  });

  const result = validateObservationQuery(params);

  assert.equal(result.valid, false);
  assert.equal(
    result.error?.message,
    "Valor de aggregation inválido.",
  );
  assert.deepEqual(result.error?.details, ["monthly"]);
});

test("rejeita limites fora do intervalo permitido", () => {
  const params = new URLSearchParams({
    stationId: "INMET:A711",
    from: "2026-10-22T00:00:00.000Z",
    to: "2026-10-23T00:00:00.000Z",
    limit: "20001",
  });

  const result = validateObservationQuery(params);

  assert.equal(result.valid, false);
  assert.match(
    result.error?.message ?? "",
    /limit deve ser um inteiro/,
  );
});

test("aceita o limite máximo de 20000 registros", () => {
  const params = new URLSearchParams({
    stationId: "INMET:A711",
    from: "2026-10-22T00:00:00.000Z",
    to: "2026-10-23T00:00:00.000Z",
    limit: "20000",
  });

  const result = validateObservationQuery(params);

  assert.equal(result.valid, true);
  assert.equal(result.data?.limit, 20000);
});