"use client";

import Link from "next/link";
import { Droplets, Gauge, Wind } from "lucide-react";
import { FavoriteButton } from "@/components/stations/FavoriteButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative, temperatureColor } from "@/lib/utils";
import { STATUS_LABELS, STATION_TYPE_LABELS, type WeatherStation } from "@/types/station";

export function StationCard({ station }: { station: WeatherStation }) {
  return (
    <Link href={`/estacoes/${station.id}`} className="block h-full">
      <Card className="h-full transition-transform hover:-translate-y-0.5 hover:border-primary/40">
        <CardContent className="flex h-full flex-col gap-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={station.status}>{STATUS_LABELS[station.status]}</Badge>
                <Badge variant="secondary">{STATION_TYPE_LABELS[station.type]}</Badge>
              </div>
              <h3 className="font-semibold leading-tight">{station.name}</h3>
              <p className="text-sm text-muted-foreground">
                {station.city}/{station.state} · {station.code}
              </p>
            </div>
            <FavoriteButton stationId={station.id} />
          </div>
          <div className="flex items-end justify-between">
            <p
              className="text-4xl font-semibold tracking-tight"
              style={{ color: temperatureColor(station.current.temperature) }}
            >
              {station.current.temperature.toFixed(1)}°
            </p>
            <p className="text-xs text-muted-foreground">
              atualizado {formatRelative(station.lastUpdate)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5" />
              {station.current.humidity}%
            </span>
            <span className="flex items-center gap-1">
              <Wind className="h-3.5 w-3.5" />
              {station.current.windSpeed.toFixed(0)} km/h
            </span>
            <span className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              {station.current.pressure.toFixed(0)} hPa
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
