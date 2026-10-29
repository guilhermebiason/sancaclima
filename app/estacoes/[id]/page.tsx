"use client";

import { notFound, useParams } from "next/navigation";
import { Droplets, Eye, Gauge, Mountain, Wind } from "lucide-react";
import { WeatherCharts } from "@/components/charts/WeatherCharts";
import { FavoriteButton } from "@/components/stations/FavoriteButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStations } from "@/hooks/useStations";
import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS, STATION_TYPE_LABELS } from "@/types/station";

export default function StationPage() {
  const params = useParams<{ id: string }>();
  const { stations, loading, error } = useStations();
  const station = stations.find((item) => item.id === params.id);

  if (loading) {
    return <div className="h-96 animate-pulse rounded-3xl bg-muted" />;
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!station) notFound();

  const metrics = [
    { icon: Droplets, label: "Umidade", value: `${station.current.humidity}%` },
    { icon: Wind, label: "Vento", value: `${station.current.windSpeed.toFixed(0)} km/h` },
    { icon: Gauge, label: "Pressão", value: `${station.current.pressure.toFixed(1)} hPa` },
    { icon: Eye, label: "Visibilidade", value: `${station.current.visibility} km` },
    { icon: Mountain, label: "Altitude", value: `${station.elevation} m` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border bg-card/80 p-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant={station.status}>{STATUS_LABELS[station.status]}</Badge>
            <Badge variant="secondary">{STATION_TYPE_LABELS[station.type]}</Badge>
            <Badge variant="outline">{station.region}</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{station.name}</h1>
          <p className="text-muted-foreground">
            {station.city}/{station.state} · {station.code} · {station.operator}
          </p>
          <p className="text-xs text-muted-foreground">
            Última atualização {formatDateTime(station.lastUpdate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-5xl font-semibold">{station.current.temperature.toFixed(1)}°C</p>
          <FavoriteButton stationId={station.id} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <item.icon className="h-4 w-4" />
                {item.label}
              </p>
              <p className="mt-2 text-xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <WeatherCharts station={station} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Previsão (mock)</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {station.forecast.slice(0, 8).map((item) => (
            <Card key={item.timestamp}>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</p>
                <p className="text-lg font-semibold">{item.temperature.toFixed(1)}°C</p>
                <p className="text-sm text-muted-foreground">{item.condition}</p>
                <p className="text-xs text-muted-foreground">
                  {item.precipitation.toFixed(1)} mm · {item.windSpeed.toFixed(0)} km/h
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
