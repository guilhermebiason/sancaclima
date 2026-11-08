import {
  calculateDailyMeteorologicalSummaries,
} from "../lib/meteorology/calculations/daily-summaries";
import {
  closePostgresPool,
  getPostgresPool,
} from "../lib/meteorology/persistence/postgres-pool";
import {
  persistDerivedObservations,
  readMeteorologicalObservations,
} from "../lib/meteorology/persistence/postgres-repository";

const STATION_ID = "INMET:A711";
const MAX_OBSERVATIONS = 20_000;
const TIME_ZONE = "America/Sao_Paulo";

function validateDateRange(from: string, to: string): void {
  const fromTimestamp = Date.parse(from);
  const toTimestamp = Date.parse(to);

  if (
    !Number.isFinite(fromTimestamp)
    || !Number.isFinite(toTimestamp)
    || fromTimestamp >= toTimestamp
  ) {
    throw new Error(
      "Informe duas datas ISO 8601 válidas, com início anterior ao fim.",
    );
  }
}

async function main(): Promise<void> {
  const from = process.argv[2];
  const to = process.argv[3];

  if (!from || !to) {
    throw new Error(
      "Uso: npm run db:reprocess:inmet-a711 -- <início ISO 8601> <fim ISO 8601>",
    );
  }

  validateDateRange(from, to);

  const pool = getPostgresPool();

  const observations = await readMeteorologicalObservations(pool, {
    stationId: STATION_ID,
    from,
    to,
    limit: MAX_OBSERVATIONS,
  });

  if (observations.length >= MAX_OBSERVATIONS) {
    throw new Error(
      `A leitura atingiu o limite de ${MAX_OBSERVATIONS} observações. `
      + "Divida o período em intervalos menores antes de reprocessar.",
    );
  }

  const sourceObservations = observations.filter(
    (observation) =>
      observation.method === "measured"
      && (
        observation.aggregation === "hourly"
        || observation.aggregation === "accumulated"
      ),
  );

  if (sourceObservations.length === 0) {
    throw new Error(
      `Nenhuma observação original encontrada para ${STATION_ID} no período informado.`,
    );
  }

  const receivedAt = new Date().toISOString();

  const derivedObservations = calculateDailyMeteorologicalSummaries(
    sourceObservations,
    {
      timeZone: TIME_ZONE,
      receivedAt,
    },
  );

  if (derivedObservations.some(
    (observation) =>
      observation.method !== "calculated"
      && observation.method !== "derived",
  )) {
    throw new Error(
      "O cálculo retornou uma observação que não é calculada ou derivada.",
    );
  }

  if (derivedObservations.length === 0) {
    process.stdout.write(
      `${JSON.stringify({
        status: "no_derived_observations",
        station: STATION_ID,
        sourceObservationCount: sourceObservations.length,
        derivedObservationCount: 0,
      }, null, 2)}\n`,
    );
    return;
  }

  const persistedCount = await persistDerivedObservations(
    pool,
    derivedObservations,
  );

  const derivedTimestamps = derivedObservations.map(
    (observation) => Date.parse(observation.observedAt),
  );

  const verificationFrom = new Date(
    Math.min(...derivedTimestamps),
  ).toISOString();

  const verificationTo = new Date(
    Math.max(...derivedTimestamps) + 1,
  ).toISOString();

  const readBack = await readMeteorologicalObservations(pool, {
    stationId: STATION_ID,
    from: verificationFrom,
    to: verificationTo,
    limit: MAX_OBSERVATIONS,
  });

  if (readBack.length >= MAX_OBSERVATIONS) {
    throw new Error(
      "A conferência atingiu o limite de leitura. "
      + "Não foi possível verificar todos os resultados.",
    );
  }

  const persistedById = new Map(
    readBack.map((observation) => [observation.id, observation]),
  );

  const missingIds = derivedObservations
    .filter((observation) => {
      const persisted = persistedById.get(observation.id);

      return !persisted
        || (
          persisted.method !== "calculated"
          && persisted.method !== "derived"
        );
    })
    .map((observation) => observation.id);

  if (missingIds.length > 0) {
    throw new Error(
      `Conferência divergente: ${missingIds.length} observações derivadas não foram recuperadas.`,
    );
  }

  if (persistedCount !== derivedObservations.length) {
    throw new Error(
      `Quantidade divergente: ${derivedObservations.length} calculadas, `
      + `${persistedCount} persistidas.`,
    );
  }

  process.stdout.write(`${JSON.stringify({
    status: "success",
    station: STATION_ID,
    period: { from, to },
    sourceObservationCount: sourceObservations.length,
    derivedObservationCount: derivedObservations.length,
    persistedCount,
    verifiedCount: derivedObservations.length,
    timeZone: TIME_ZONE,
  }, null, 2)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
