import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { calculateDailyMeteorologicalSummaries } from "../lib/meteorology/calculations/daily-summaries";
import { normalizeInmetCsv } from "../lib/meteorology/providers/inmet/normalizer";
import { parseInmetHourlyCsv } from "../lib/meteorology/providers/inmet/parser";
import { closePostgresPool, getPostgresPool } from "../lib/meteorology/persistence/postgres-pool";
import { persistInmetImport, readMeteorologicalObservations } from "../lib/meteorology/persistence/postgres-repository";

const defaultFixture = resolve(
  process.cwd(),
  "tests/fixtures/inmet/dados_A711_H_2026-10-22_2026-10-29.csv.gz.base64",
);
const inputPath = process.argv[2] ? resolve(process.argv[2]) : defaultFixture;

function readCsvFile(path: string): { csv: string; bytes: Buffer; fileName: string } {
  const input = readFileSync(path);
  if (path.endsWith(".csv.gz.base64")) {
    const bytes = gunzipSync(Buffer.from(input.toString("utf8").trim(), "base64"));
    return {
      csv: bytes.toString("utf8"),
      bytes,
      fileName: "dados_A711_H_2026-10-22_2026-10-29.csv",
    };
  }
  if (path.endsWith(".csv.gz")) {
    const bytes = gunzipSync(input);
    return { csv: bytes.toString("utf8"), bytes, fileName: basename(path, ".gz") };
  }
  return { csv: input.toString("utf8"), bytes: input, fileName: basename(path) };
}

async function main(): Promise<void> {
  const { csv, bytes, fileName } = readCsvFile(inputPath);
  const receivedAt = new Date().toISOString();
  const parsed = parseInmetHourlyCsv(csv);
  const normalized = normalizeInmetCsv(parsed, receivedAt);
  const derived = calculateDailyMeteorologicalSummaries(normalized.observations, {
    timeZone: "America/Sao_Paulo",
    receivedAt,
  });
  const rawRecords = parsed.records.map((record) => ({
    id: `${normalized.station.id}:${record.observedAt}`,
    sourceLine: record.sourceLine,
    observedAt: record.observedAt,
    rawPayload: record.values as unknown as Record<string, unknown>,
  }));

  const pool = getPostgresPool();
  const result = await persistInmetImport({
    pool,
    dataSource: normalized.dataSource,
    station: normalized.station,
    observations: [...normalized.observations, ...derived],
    rawRecords,
    rawFile: bytes,
    fileName,
    receivedAt,
  });

  const allObservations = [...normalized.observations, ...derived];
  const timestamps = allObservations.map((observation) => Date.parse(observation.observedAt));
  const from = new Date(Math.min(...timestamps)).toISOString();
  const to = new Date(Math.max(...timestamps) + 1).toISOString();
  const persisted = await readMeteorologicalObservations(pool, {
    stationId: normalized.station.id,
    from,
    to,
    limit: 5000,
  });
  if (persisted.length !== result.observationCount) {
    throw new Error(`Read-back divergente: esperadas ${result.observationCount}, recuperadas ${persisted.length} observações.`);
  }
  const negativeRadiation = persisted.filter((observation) =>
    observation.variable === "solar_radiation"
    && observation.value !== null
    && observation.value < 0,
  );
  if (negativeRadiation.length !== 80 || !negativeRadiation.every((observation) =>
    observation.quality === "suspect"
    && observation.qualityFlags.includes("outside_physical_range"),
  )) {
    throw new Error("A leitura de volta não preservou as 80 radiações negativas como suspeitas.");
  }

  process.stdout.write(`${JSON.stringify({
    status: "success",
    station: normalized.station.id,
    readBackCount: persisted.length,
    negativeRadiationPreserved: negativeRadiation.length,
    ...result,
  }, null, 2)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
