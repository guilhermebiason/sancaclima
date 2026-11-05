import { NextRequest, NextResponse } from "next/server";

import { getPostgresPool } from "@/lib/meteorology/persistence/postgres-pool";
import { getStationQualityStatistics } from "@/lib/meteorology/services/quality-report-service";
import { validateObservationQuery } from "@/lib/meteorology/services/query-validation";

import type {
  MeteorologicalVariable,
} from "@/types/meteorology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_VARIABLES: MeteorologicalVariable[] = [
  "air_temperature",
  "dew_point_temperature",
  "relative_humidity",
  "sea_level_pressure",
  "precipitation",
  "wind_speed",
  "wind_direction",
  "solar_radiation",
];

export async function GET(request: NextRequest) {
  const validation = validateObservationQuery(
    request.nextUrl.searchParams,
  );

  if (!validation.valid || !validation.data) {
    const error = validation.error;

    if (error?.message === "Parâmetros obrigatórios ausentes.") {
      return NextResponse.json(
        {
          error: error.message,
          required: error.details,
        },
        { status: 400 },
      );
    }

    if (error?.message === "Valor de aggregation inválido.") {
      return NextResponse.json(
        {
          error: error.message,
          allowed: [
            "instantaneous",
            "hourly",
            "daily",
            "accumulated",
          ],
          received: error.details,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error?.message ?? "Parâmetros de consulta inválidos.",
      },
      { status: 400 },
    );
  }

  const query = validation.data;

  const invalidVariables = (query.variables ?? []).filter(
    (variable) =>
      !VALID_VARIABLES.includes(variable as MeteorologicalVariable),
  );

  if (invalidVariables.length > 0) {
    return NextResponse.json(
      {
        error: "Valor de variable inválido.",
        allowed: VALID_VARIABLES,
        received: invalidVariables,
      },
      { status: 400 },
    );
  }

  try {
    const report = await getStationQualityStatistics(
      getPostgresPool(),
      {
        stationId: query.stationId,
        from: query.from,
        to: query.to,
        variables: query.variables as
          | MeteorologicalVariable[]
          | undefined,
        aggregations: query.aggregations,
      },
    );

    return NextResponse.json(
      {
        ...report,
        filters: {
          variables: query.variables ?? null,
          aggregations: query.aggregations ?? null,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("timestamps ISO 8601")
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("[API meteorology/quality-report]", error);

    return NextResponse.json(
      {
        error: "Não foi possível gerar o relatório de qualidade meteorológica.",
      },
      { status: 500 },
    );
  }
}