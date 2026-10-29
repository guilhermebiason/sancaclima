"use client";

import { useMemo, useState } from "react";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStations } from "@/hooks/useStations";
import {
  REGION_OPTIONS,
  VARIABLE_LABELS,
  type WeatherVariable,
} from "@/types/station";

export default function ChartsPage() {
  const { stations, loading, error } = useStations();
  const [region, setRegion] = useState("todas");
  const [variable, setVariable] = useState<WeatherVariable>("temperature");
  const [hours, setHours] = useState(24);
  const [selected, setSelected] = useState<string[]>(["a701", "a602", "a801"]);

  const available = useMemo(
    () => stations.filter((station) => region === "todas" || station.region === region),
    [stations, region],
  );
  const compared = available.filter((station) => selected.includes(station.id));

  function toggleStation(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gráficos & Filtros</h1>
        <p className="text-sm text-muted-foreground">
          Compare estações, escolha a variável e exporte o gráfico em PNG.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Região</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {REGION_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Variável</Label>
          <Select value={variable} onValueChange={(value) => setVariable(value as WeatherVariable)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VARIABLE_LABELS) as WeatherVariable[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {VARIABLE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Período</Label>
          <Select value={String(hours)} onValueChange={(value) => setHours(Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="48">48 horas</SelectItem>
              <SelectItem value="72">72 horas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando estações...</p>
        ) : (
          available.map((station) => {
            const active = selected.includes(station.id);
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => toggleStation(station.id)}
                className={
                  active
                    ? "rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                    : "rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
                }
              >
                {station.city} · {station.code}
              </button>
            );
          })
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ComparisonChart stations={compared} variable={variable} hours={hours} />
    </div>
  );
}
