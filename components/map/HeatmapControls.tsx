"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { HeatmapState } from "@/types/layers";
import { VARIABLE_LABELS, type WeatherVariable } from "@/types/station";

export function HeatmapControls({
  value,
  onChange,
}: {
  value: HeatmapState;
  onChange: (next: HeatmapState) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Heatmap</p>
          <p className="text-xs text-muted-foreground">Densidade interpolada das estações</p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Variável</Label>
        <Select
          value={value.variable}
          onValueChange={(variable) =>
            onChange({ ...value, variable: variable as WeatherVariable })
          }
          disabled={!value.enabled}
        >
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
        <Label>Opacidade {Math.round(value.opacity * 100)}%</Label>
        <Slider
          min={0.15}
          max={1}
          step={0.05}
          value={[value.opacity]}
          disabled={!value.enabled}
          onValueChange={(values) => onChange({ ...value, opacity: values[0] ?? value.opacity })}
        />
      </div>
    </div>
  );
}
