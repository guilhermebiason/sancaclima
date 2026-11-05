
import type { Pool } from "pg";
import type {
  MeteorologicalVariable,
  ObservationAggregation,
  QualityStatus,
} from "../../../types/meteorology";

export interface QualityReportInput {
  stationId: string;
  from: string;
  to: string;
  variables?: MeteorologicalVariable[];
  aggregations?: ObservationAggregation[];
}

export interface QualityCounts {
  total: number;
  pending: number;
  valid: number;
  suspect: number;
  invalid: number;
}

export interface QualityPercentages {
  pending: number;
  valid: number;
  suspect: number;
  invalid: number;
}

export interface VariableQualityReport extends QualityCounts {
  variable: MeteorologicalVariable;
}

export interface QualityFlagReport {
  flag: string;
  count: number;
  percentage: number;
}

export interface StationQualityReport {
  stationId: string;
  period: {
    from: string;
    to: string;
  };
  summary: QualityCounts;
  percentages: QualityPercentages;
  byVariable: VariableQualityReport[];
  flags: QualityFlagReport[];
}

interface QualityCountRow {
  quality: QualityStatus;
  count: string | number;
}

interface VariableCountRow {
  variable: MeteorologicalVariable;
  quality: QualityStatus;
  count: string | number;
}

interface FlagCountRow {
  flag: string;
  count: string | number;
}

function createQualityCounts(): QualityCounts {
  return {
    total: 0,
    pending: 0,
    valid: 0,
    suspect: 0,
    invalid: 0,
  };
}

function calculatePercentage(count: number, total: number): number {
  return total === 0
    ? 0
    : Number(((count / total) * 100).toFixed(2));
}

/**
 * Consolida indicadores de qualidade diretamente no PostgreSQL.
 * Não recalcula nem modifica a qualidade das observações armazenadas.
 */
export async function getStationQualityStatistics(
  pool: Pool,
  input: QualityReportInput,
): Promise<StationQualityReport> {
  const fromTimestamp = Date.parse(input.from);
  const toTimestamp = Date.parse(input.to);

  if (
    !Number.isFinite(fromTimestamp) ||
    !Number.isFinite(toTimestamp) ||
    fromTimestamp >= toTimestamp
  ) {
    throw new Error(
      "Informe timestamps ISO 8601 válidos e um início anterior ao fim.",
    );
  }

   const values: unknown[] = [
    input.stationId,
    input.from,
    input.to,
  ];

  let filters = "";

  if (input.variables?.length) {
    values.push(input.variables);
    filters += ` AND observations.variable = ANY($${values.length}::text[])`;
  }

  if (input.aggregations?.length) {
    values.push(input.aggregations);
    filters += ` AND observations.aggregation = ANY($${values.length}::text[])`;
  }

  const whereClause = `
    WHERE observations.station_id = $1
      AND observations.observed_at >= $2
      AND observations.observed_at < $3
      ${filters}
  `;

  const [summaryResult, variableResult, flagResult] = await Promise.all([
    pool.query<QualityCountRow>(
      `SELECT observations.quality, COUNT(*)::integer AS count
       FROM meteorological_observations AS observations
       ${whereClause}
       GROUP BY observations.quality`,
      values,
    ),

    pool.query<VariableCountRow>(
      `SELECT observations.variable, observations.quality,
              COUNT(*)::integer AS count
       FROM meteorological_observations AS observations
       ${whereClause}
       GROUP BY observations.variable, observations.quality
       ORDER BY observations.variable`,
      values,
    ),

    pool.query<FlagCountRow>(
      `SELECT flags.flag,
              COUNT(DISTINCT observations.id)::integer AS count
       FROM meteorological_observations AS observations
       CROSS JOIN LATERAL UNNEST(observations.quality_flags) AS flags(flag)
       ${whereClause}
       GROUP BY flags.flag
       ORDER BY count DESC, flags.flag`,
      values,
    ),
  ]);

  const summary = createQualityCounts();

  for (const row of summaryResult.rows) {
    summary[row.quality] = Number(row.count);
  }

  summary.total =
    summary.pending +
    summary.valid +
    summary.suspect +
    summary.invalid;

  const percentages: QualityPercentages = {
    pending: calculatePercentage(summary.pending, summary.total),
    valid: calculatePercentage(summary.valid, summary.total),
    suspect: calculatePercentage(summary.suspect, summary.total),
    invalid: calculatePercentage(summary.invalid, summary.total),
  };

  const variableMap = new Map<
    MeteorologicalVariable,
    QualityCounts
  >();

  for (const row of variableResult.rows) {
    if (!variableMap.has(row.variable)) {
      variableMap.set(row.variable, createQualityCounts());
    }

    const counts = variableMap.get(row.variable)!;
    counts[row.quality] = Number(row.count);
  }

  const byVariable: VariableQualityReport[] = Array.from(
    variableMap.entries(),
  ).map(([variable, counts]) => {
    counts.total =
      counts.pending +
      counts.valid +
      counts.suspect +
      counts.invalid;

    return {
      variable,
      ...counts,
    };
  });

  const flags: QualityFlagReport[] = flagResult.rows.map((row) => {
    const count = Number(row.count);

    return {
      flag: row.flag,
      count,
      percentage: calculatePercentage(count, summary.total),
    };
  });

  return {
    stationId: input.stationId,
    period: {
      from: input.from,
      to: input.to,
    },
    summary,
    percentages,
    byVariable,
    flags,
  };
}
