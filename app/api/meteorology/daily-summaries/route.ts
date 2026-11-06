
import { NextRequest, NextResponse } from "next/server";

import { getPostgresPool } from "@/lib/meteorology/persistence/postgres-pool";
import { getDailySummaries } from "@/lib/meteorology/services/observation-service";
import { validateObservationQuery } from "@/lib/meteorology/services/query-validation";

import type { ObservationServiceInput } from "@/lib/meteorology/services/observation-service";
import type { MeteorologicalObservation } from "@/types/meteorology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DailySummariesExecutor = (
  query: ObservationServiceInput,
) => Promise<MeteorologicalObservation[]>;

export function createDailySummariesHandler(
  execute: DailySummariesExecutor,
) {
  return async function GET(request: NextRequest) {
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

      return NextResponse.json(
        {
          error: error?.message ?? "Parâmetros de consulta inválidos.",
        },
        { status: 400 },
      );
    }

    const query = validation.data;

    if (
      query.aggregations?.some((aggregation) => aggregation !== "daily")
    ) {
      return NextResponse.json(
        {
          error: "Esta rota aceita somente a agregação daily.",
          allowed: ["daily"],
          received: query.aggregations,
        },
        { status: 400 },
      );
    }

    try {
      const summaries = await execute(query);

      return NextResponse.json(
        {
          stationId: query.stationId,
          period: {
            from: query.from,
            to: query.to,
          },
          aggregation: "daily",
          filters: {
            variables: query.variables ?? null,
          },
          count: summaries.length,
          summaries,
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

      console.error("[API meteorology/daily-summaries]", error);

      return NextResponse.json(
        {
          error: "Não foi possível consultar os resumos meteorológicos diários.",
        },
        { status: 500 },
      );
    }
  };
}

export async function GET(request: NextRequest) {
  return createDailySummariesHandler((query) =>
    getDailySummaries(getPostgresPool(), query),
  )(request);
}
