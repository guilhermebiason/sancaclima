import type {
  MeteorologicalObservation,
  ObservationStatistic,
  QualityFlag,
} from "../../../types/meteorology";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_MINIMUM_COVERAGE = 0.75;
const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface DailySummaryOptions {
  timeZone?: string;
  receivedAt?: string;
  minimumCoverage?: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** Converte uma data/hora civil do fuso informado para UTC, sem dependência externa. */
function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour);
  let guess = targetAsUtc;

  // Ajusta a estimativa usando o deslocamento real do fuso naquela data.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = zonedParts(new Date(guess), timeZone);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const correction = targetAsUtc - representedAsUtc;
    guess += correction;
    if (correction === 0) break;
  }

  return new Date(guess);
}

function localDateKey(timestamp: string, timeZone: string): string {
  const parts = zonedParts(new Date(timestamp), timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function nextCalendarDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function localDayBounds(dateKey: string, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = nextCalendarDate(dateKey).split("-").map(Number);
  return {
    start: zonedDateTimeToUtc(year, month, day, 0, timeZone),
    end: zonedDateTimeToUtc(next[0], next[1], next[2], 0, timeZone),
  };
}

function isUsable(observation: MeteorologicalObservation): observation is MeteorologicalObservation & { value: number } {
  return observation.value !== null
    && observation.quality === "valid"
    && !observation.qualityFlags.includes("duplicate")
    && !observation.qualityFlags.includes("outside_physical_range");
}

/**
 * Calcula ponto de orvalho (°C) pela aproximação de Magnus.
 * Requer temperatura em °C e umidade relativa entre 0 e 100%.
 * RH=0 não produz um resultado finito e é tratado como ausência.
 */
export function calculateDewPointCelsius(
  airTemperatureCelsius: number,
  relativeHumidityPercent: number,
): number | null {
  if (
    !Number.isFinite(airTemperatureCelsius)
    || !Number.isFinite(relativeHumidityPercent)
    || airTemperatureCelsius < -90
    || airTemperatureCelsius > 60
    || relativeHumidityPercent <= 0
    || relativeHumidityPercent > 100
  ) {
    return null;
  }

  const gamma = Math.log(relativeHumidityPercent / 100)
    + (MAGNUS_A * airTemperatureCelsius) / (MAGNUS_B + airTemperatureCelsius);
  const dewPoint = (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
  return Number.isFinite(dewPoint) ? dewPoint : null;
}

function dailyObservation(
  template: MeteorologicalObservation,
  statistic: ObservationStatistic,
  value: number,
  periodStart: Date,
  periodEnd: Date,
  receivedAt: string,
  expectedRecords: number,
  availableRecords: number,
  minimumCoverage: number,
): MeteorologicalObservation {
  const completenessRatio = expectedRecords > 0 ? availableRecords / expectedRecords : 0;
  const qualityFlags: QualityFlag[] = completenessRatio < minimumCoverage
    ? ["insufficient_coverage"]
    : [];

  return {
    id: `daily:${template.stationId}:${template.variable}:${statistic}:${periodStart.toISOString()}`,
    stationId: template.stationId,
    sourceId: template.sourceId,
    variable: template.variable,
    value,
    unit: template.unit,
    observedAt: new Date(periodEnd.getTime() - 1).toISOString(),
    receivedAt,
    aggregation: "daily",
    statistic,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    method: "calculated",
    coverage: { expectedRecords, availableRecords, completenessRatio },
    quality: qualityFlags.length ? "suspect" : "valid",
    qualityFlags,
  };
}

function summarizeDay(
  observations: MeteorologicalObservation[],
  periodStart: Date,
  periodEnd: Date,
  receivedAt: string,
  expectedRecords: number,
  minimumCoverage: number,
): MeteorologicalObservation[] {
  const usable = observations.filter(isUsable);
  if (usable.length === 0) return [];

  const values = usable.map((item) => item.value);
  const template = usable[0];
  const availableRecords = new Set(usable.map((item) => item.observedAt)).size;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  return [
    dailyObservation(template, "minimum", min, periodStart, periodEnd, receivedAt, expectedRecords, availableRecords, minimumCoverage),
    dailyObservation(template, "maximum", max, periodStart, periodEnd, receivedAt, expectedRecords, availableRecords, minimumCoverage),
    dailyObservation(template, "mean", mean, periodStart, periodEnd, receivedAt, expectedRecords, availableRecords, minimumCoverage),
  ];
}

/**
 * Gera ponto de orvalho horário e estatísticas diárias de temperatura e ponto
 * de orvalho. Dias são definidos pelo fuso local; os limites são armazenados em UTC.
 *
 * Somente observações com qualidade "valid" entram nos cálculos. Assim, valores
 * ausentes, duplicados ou suspeitos não contaminam silenciosamente as estatísticas.
 */
export function calculateDailyMeteorologicalSummaries(
  observations: MeteorologicalObservation[],
  options: DailySummaryOptions = {},
): MeteorologicalObservation[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const receivedAt = options.receivedAt ?? new Date().toISOString();
  const minimumCoverage = options.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE;

  if (Number.isNaN(Date.parse(receivedAt))) {
    throw new Error("receivedAt deve ser um timestamp ISO 8601 válido.");
  }
  if (!Number.isFinite(minimumCoverage) || minimumCoverage < 0 || minimumCoverage > 1) {
    throw new Error("minimumCoverage deve estar entre 0 e 1.");
  }

  // Valida o identificador do fuso antes de iniciar o processamento.
  new Intl.DateTimeFormat("en-US", { timeZone });

  const byStationAndTime = new Map<string, Map<string, MeteorologicalObservation>>();
  for (const observation of observations) {
    if (
      observation.aggregation !== "hourly"
      || (observation.variable !== "air_temperature" && observation.variable !== "relative_humidity")
      || !isUsable(observation)
    ) continue;

    const key = `${observation.stationId}|${observation.observedAt}`;
    const values = byStationAndTime.get(key) ?? new Map<string, MeteorologicalObservation>();
    values.set(observation.variable, observation);
    byStationAndTime.set(key, values);
  }

  const dewPointHourly: MeteorologicalObservation[] = [];
  for (const [key, pair] of byStationAndTime) {
    const temperature = pair.get("air_temperature");
    const humidity = pair.get("relative_humidity");
    if (!temperature || !humidity || temperature.value === null || humidity.value === null) continue;

    const dewPoint = calculateDewPointCelsius(temperature.value, humidity.value);
    if (dewPoint === null) continue;

    dewPointHourly.push({
      id: `derived:dew-point:${key}`,
      stationId: temperature.stationId,
      sourceId: temperature.sourceId,
      variable: "dew_point_temperature",
      value: dewPoint,
      unit: "°C",
      observedAt: temperature.observedAt,
      receivedAt,
      aggregation: "hourly",
      method: "derived",
      quality: "valid",
      qualityFlags: [],
    });
  }

  const dailyGroups = new Map<string, MeteorologicalObservation[]>();
  for (const observation of [...observations, ...dewPointHourly]) {
    if (
      observation.aggregation !== "hourly"
      || (observation.variable !== "air_temperature" && observation.variable !== "dew_point_temperature")
    ) continue;

    const date = localDateKey(observation.observedAt, timeZone);
    const key = `${observation.stationId}|${observation.variable}|${date}`;
    const group = dailyGroups.get(key) ?? [];
    group.push(observation);
    dailyGroups.set(key, group);
  }

  const dailySummaries: MeteorologicalObservation[] = [];
  for (const [key, group] of dailyGroups) {
    const date = key.slice(key.lastIndexOf("|") + 1);
    const { start, end } = localDayBounds(date, timeZone);
    const expectedRecords = Math.round((end.getTime() - start.getTime()) / 3_600_000);
    dailySummaries.push(...summarizeDay(
      group,
      start,
      end,
      receivedAt,
      expectedRecords,
      minimumCoverage,
    ));
  }

  return [...dewPointHourly, ...dailySummaries].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt)
    || a.variable.localeCompare(b.variable)
    || (a.statistic ?? "").localeCompare(b.statistic ?? ""),
  );
}
