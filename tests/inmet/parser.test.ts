import assert from "node:assert/strict";
import test from "node:test";
import { parseInmetHourlyCsv } from "../../lib/meteorology/providers/inmet/parser";
import { normalizeInmetCsv } from "../../lib/meteorology/providers/inmet/normalizer";

const HEADER = [
  "Data Medicao",
  "Hora Medicao",
  "PRECIPITACAO TOTAL, HORARIO(mm)",
  "RADIACAO GLOBAL(Kj/m²)",
  "TEMPERATURA DO AR - BULBO SECO, HORARIA(°C)",
  "UMIDADE RELATIVA DO AR, HORARIA(%)",
  "VENTO, DIRECAO HORARIA (gr)(° (gr))",
  "VENTO, VELOCIDADE HORARIA(m/s)",
].join(";");

function csv(rows: string[]): string {
  return [
    "Nome: SAO CARLOS",
    "Codigo Estacao: A711",
    "Latitude: -21.98027777",
    "Longitude: -47.88388888",
    "Altitude: 859.29",
    "Situacao: Operante",
    "Data Inicial: 2026-10-22",
    "Data Final: 2026-10-22",
    "Periodicidade da Medicao: Horaria",
    "",
    HEADER,
    ...rows,
  ].join("\n");
}

test("interpreta metadados, vírgula decimal e horário UTC", () => {
  const parsed = parseInmetHourlyCsv(csv([
    "2026-10-22;0000;1,2;-3,5;21,7;57;129;2,4;",
  ]));

  assert.equal(parsed.station.code, "A711");
  assert.equal(parsed.station.latitude, -21.98027777);
  assert.equal(parsed.records[0].observedAt, "2026-10-22T00:00:00.000Z");
  assert.equal(parsed.records[0].values.precipitation, 1.2);
  assert.equal(parsed.records[0].values.airTemperature, 21.7);
  assert.equal(parsed.records[0].values.solarRadiation, -3.5);
});

test("normaliza seis variáveis com unidades e agregações explícitas", () => {
  const parsed = parseInmetHourlyCsv(csv([
    "2026-10-22;0000;1,2;100;21,7;57;129;2,4;",
  ]));
  const normalized = normalizeInmetCsv(parsed, "2026-10-30T00:00:00.000Z");

  assert.equal(normalized.station.id, "INMET:A711");
  assert.equal(normalized.dataSource.provider, "INMET");
  assert.equal(normalized.observations.length, 6);
  assert.equal(
    normalized.observations.find((item) => item.variable === "precipitation")?.aggregation,
    "accumulated",
  );
  assert.equal(
    normalized.observations.find((item) => item.variable === "wind_speed")?.unit,
    "m/s",
  );
  assert.ok(normalized.observations.every((item) => item.receivedAt === "2026-10-30T00:00:00.000Z"));
});

test("preserva radiação negativa e sinaliza como suspeita", () => {
  const parsed = parseInmetHourlyCsv(csv([
    "2026-10-22;0000;0;-3,5;21,7;57;129;2,4;",
  ]));
  const normalized = normalizeInmetCsv(parsed, "2026-10-30T00:00:00.000Z");
  const radiation = normalized.observations.find((item) => item.variable === "solar_radiation");

  assert.equal(radiation?.value, -3.5);
  assert.equal(radiation?.quality, "suspect");
  assert.ok(radiation?.qualityFlags.includes("outside_physical_range"));
});

test("converte sentinela de ausência em null, sem transformar em zero", () => {
  const parsed = parseInmetHourlyCsv(csv([
    "2026-10-22;0000;9999;100;21,7;57;129;2,4;",
  ]));
  const normalized = normalizeInmetCsv(parsed, "2026-10-30T00:00:00.000Z");
  const precipitation = normalized.observations.find((item) => item.variable === "precipitation");

  assert.equal(precipitation?.value, null);
  assert.equal(precipitation?.quality, "invalid");
  assert.ok(precipitation?.qualityFlags.includes("missing_value"));
});

test("identifica timestamps duplicados sem remover registros", () => {
  const parsed = parseInmetHourlyCsv(csv([
    "2026-10-22;0000;0;100;21,7;57;129;2,4;",
    "2026-10-22;0000;0;110;21,8;58;130;2,5;",
  ]));
  const normalized = normalizeInmetCsv(parsed, "2026-10-30T00:00:00.000Z");
  const temperatures = normalized.observations.filter((item) => item.variable === "air_temperature");

  assert.equal(temperatures.length, 2);
  assert.ok(temperatures.every((item) => item.qualityFlags.includes("duplicate")));
});
