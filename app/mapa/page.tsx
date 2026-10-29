"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { MapFilters } from "@/components/map/MapFilters";
import { useStations } from "@/hooks/useStations";
import { DEFAULT_MAP_FILTERS, DEFAULT_MAP_LAYERS } from "@/types/layers";

const WeatherMap = dynamic(
  () => import("@/components/map/WeatherMap").then((mod) => mod.WeatherMap),
  {
    ssr: false,
    loading: () => <div className="h-[min(78vh,820px)] animate-pulse rounded-3xl bg-muted" />,
  },
);

export default function MapPage() {
  const { stations, loading, error } = useStations();
  const [layers, setLayers] = useState(DEFAULT_MAP_LAYERS);
  const [filters, setFilters] = useState(DEFAULT_MAP_FILTERS);

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return stations.filter((station) => {
      const regionOk = filters.region === "todas" || station.region === filters.region;
      const typeOk = filters.type === "todos" || station.type === filters.type;
      const statusOk = filters.status === "todos" || station.status === filters.status;
      const queryOk =
        !query ||
        station.name.toLowerCase().includes(query) ||
        station.city.toLowerCase().includes(query) ||
        station.code.toLowerCase().includes(query);
      return regionOk && typeOk && statusOk && queryOk;
    });
  }, [stations, filters]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mapa interativo</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} estações visíveis · clustering, heatmap, GOES e radar
        </p>
      </div>
      <MapFilters value={filters} onChange={setFilters} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="h-[min(78vh,820px)] animate-pulse rounded-3xl bg-muted" />
      ) : (
        <WeatherMap stations={filtered} layers={layers} onLayersChange={setLayers} />
      )}
    </div>
  );
}
