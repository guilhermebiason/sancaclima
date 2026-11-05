import { NextRequest, NextResponse } from "next/server";

import { getPostgresPool } from "@/lib/meteorology/persistence/postgres-pool";
import { getStationObservations } from "@/lib/meteorology/services/observation-service";
import { validateObservationQuery } from "@/lib/meteorology/services/query-validation";
import type { ObservationAggregation } from "@/types/meteorology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_AGGREGATIONS: ObservationAggregation[] = [
  "instantaneous",
  "hourly",
  "daily",
  "accumulated",
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
          allowed: VALID_AGGREGATIONS,
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

  try {
    const observations = await getStationObservations(
      getPostgresPool(),
      query,
    );

    return NextResponse.json(
      {
        stationId: query.stationId,
        period: {
          from: query.from,
          to: query.to,
        },
        filters: {
          variables: query.variables ?? null,
          aggregations: query.aggregations ?? null,
        },
        count: observations.length,
        observations,
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

    console.error("[API meteorology/observations]", error);

    return NextResponse.json(
      {
        error: "Não foi possível consultar as observações meteorológicas.",
      },
      { status: 500 },
    );
  }
}