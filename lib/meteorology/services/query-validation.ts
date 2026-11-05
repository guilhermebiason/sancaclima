import type { ObservationAggregation } from "../../../types/meteorology";

const VALID_AGGREGATIONS: ObservationAggregation[] = [
  "instantaneous",
  "hourly",
  "daily",
  "accumulated",
];

export interface ObservationQuery {
  stationId: string;
  from: string;
  to: string;
  variables?: string[];
  aggregations?: ObservationAggregation[];
  limit?: number;
}

export interface QueryValidationResult {
  valid: boolean;
  data?: ObservationQuery;
  error?: {
    message: string;
    details?: string[];
  };
}

export function validateObservationQuery(
  params: URLSearchParams,
): QueryValidationResult {
  const stationId = params.get("stationId");
  const from = params.get("from");
  const to = params.get("to");

  if (!stationId || !from || !to) {
    return {
      valid: false,
      error: {
        message: "Parâmetros obrigatórios ausentes.",
        details: ["stationId", "from", "to"],
      },
    };
  }

  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? undefined : Number(rawLimit);

  if (
    rawLimit !== null &&
    (!Number.isInteger(limit) || limit! < 1 || limit! > 20_000)
  ) {
    return {
      valid: false,
      error: {
        message: "O parâmetro limit deve ser um inteiro entre 1 e 20000.",
      },
    };
  }

  const variables = params.getAll("variable");
  const rawAggregations = params.getAll("aggregation");

  const invalidAggregations = rawAggregations.filter(
    (value) =>
      !VALID_AGGREGATIONS.includes(value as ObservationAggregation),
  );

  if (invalidAggregations.length > 0) {
    return {
      valid: false,
      error: {
        message: "Valor de aggregation inválido.",
        details: invalidAggregations,
      },
    };
  }

  return {
    valid: true,
    data: {
      stationId,
      from,
      to,
      variables: variables.length > 0 ? variables : undefined,
      aggregations:
        rawAggregations.length > 0
          ? (rawAggregations as ObservationAggregation[])
          : undefined,
      limit,
    },
  };
}