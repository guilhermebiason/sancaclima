"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MapFilters as MapFiltersState } from "@/types/layers";
import { REGION_OPTIONS, STATION_TYPE_LABELS } from "@/types/station";

export function MapFilters({
  value,
  onChange,
}: {
  value: MapFiltersState;
  onChange: (next: MapFiltersState) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder="Buscar cidade, código..."
        value={value.query}
        onChange={(event) => onChange({ ...value, query: event.target.value })}
      />
      <Select value={value.region} onValueChange={(region) => onChange({ ...value, region })}>
        <SelectTrigger>
          <SelectValue placeholder="Região" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as regiões</SelectItem>
          {REGION_OPTIONS.map((region) => (
            <SelectItem key={region} value={region}>
              {region}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.type} onValueChange={(type) => onChange({ ...value, type })}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tipos</SelectItem>
          {Object.entries(STATION_TYPE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.status} onValueChange={(status) => onChange({ ...value, status })}>
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="online">Online</SelectItem>
          <SelectItem value="atrasada">Atrasada</SelectItem>
          <SelectItem value="offline">Offline</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
