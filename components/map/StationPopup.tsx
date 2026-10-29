"use client";

import Link from "next/link";
import { FavoriteButton } from "@/components/stations/FavoriteButton";
import { StationMiniChart } from "@/components/charts/StationMiniChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { STATUS_LABELS, type WeatherStation } from "@/types/station";

export function StationPopup({ station }: { station: WeatherStation }) {
  return (
    <div className="w-[280px] rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {station.code} · {station.city}/{station.state}
          </p>
          <h3 className="text-sm font-semibold leading-tight">{station.name}</h3>
        </div>
        <FavoriteButton stationId={station.id} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-2xl font-semibold">{station.current.temperature.toFixed(1)}°C</p>
        <Badge variant={station.status}>{STATUS_LABELS[station.status]}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        UR {station.current.humidity}% · Vento {station.current.windSpeed.toFixed(0)} km/h ·
        {` ${station.current.precipitation.toFixed(1)} mm`}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Atualizado {formatRelative(station.lastUpdate)}
      </p>
      <StationMiniChart station={station} />
      <Button asChild className="mt-2 w-full" size="sm">
        <Link href={`/estacoes/${station.id}`}>Ver detalhes completos</Link>
      </Button>
    </div>
  );
}
