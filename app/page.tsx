"use client";

import Link from "next/link";
import { ArrowRight, CloudRain, Thermometer, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { StationCard } from "@/components/stations/StationCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFavorites } from "@/hooks/useFavorites";
import { useStations } from "@/hooks/useStations";

export default function HomePage() {
  const { stations, loading, error, highlights } = useStations();
  const { favorites } = useFavorites();
  const favoriteStations = stations.filter((station) => favorites.includes(station.id));
  const latest = [...stations].sort(
    (a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime(),
  );

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border bg-card/70 p-6 md:p-10">
        <Badge>Rede experimental · dados mockados INMET/REDEMET</Badge>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
          O pulso do tempo no Brasil, em um só mapa.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Estações automáticas, aeroportos e camadas de satélite GOES e radar.
          Explore heatmap de temperatura, umidade, vento, pressão e chuva.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/mapa">
              Abrir mapa interativo <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/graficos">Comparar gráficos</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !highlights ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="h-28 animate-pulse bg-muted" />
          ))
        ) : (
          <>
            <Highlight
              icon={<Thermometer className="h-4 w-4" />}
              label="Mais quente"
              value={`${highlights.hottest.current.temperature.toFixed(1)}°C`}
              hint={highlights.hottest.city}
            />
            <Highlight
              icon={<Thermometer className="h-4 w-4" />}
              label="Mais fria"
              value={`${highlights.coldest.current.temperature.toFixed(1)}°C`}
              hint={highlights.coldest.city}
            />
            <Highlight
              icon={<CloudRain className="h-4 w-4" />}
              label="Maior chuva"
              value={`${highlights.wettest.current.precipitation.toFixed(1)} mm`}
              hint={highlights.wettest.city}
            />
            <Highlight
              icon={<Wind className="h-4 w-4" />}
              label="Vento mais forte"
              value={`${highlights.windiest.current.windSpeed.toFixed(0)} km/h`}
              hint={highlights.windiest.city}
            />
          </>
        )}
      </section>

      {favoriteStations.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Suas favoritas</h2>
            <p className="text-sm text-muted-foreground">{favoriteStations.length} salvas</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favoriteStations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Últimas atualizações</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="h-48 animate-pulse bg-muted" />
              ))
            : latest.slice(0, 6).map((station) => (
                <StationCard key={station.id} station={station} />
              ))}
        </div>
      </section>
    </div>
  );
}

function Highlight({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
