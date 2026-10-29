"use client";

import { Layers } from "lucide-react";
import { HeatmapControls } from "@/components/map/HeatmapControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { MapLayerState, OverlayState } from "@/types/layers";

function OverlayRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: OverlayState;
  onChange: (next: OverlayState) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        />
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

export function LayerControls({
  value,
  onChange,
}: {
  value: MapLayerState;
  onChange: (next: MapLayerState) => void;
}) {
  return (
    <Card className="border-border/70 bg-background/90 shadow-lg backdrop-blur-md">
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <Layers className="h-4 w-4 text-cyan-500" />
        <CardTitle className="text-sm">Camadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <HeatmapControls
          value={value.heatmap}
          onChange={(heatmap) => onChange({ ...value, heatmap })}
        />
        <Separator />
        <OverlayRow
          title="Satélite GOES"
          hint="América do Sul · NASA GIBS"
          value={value.satellite}
          onChange={(satellite) => onChange({ ...value, satellite })}
        />
        <Separator />
        <OverlayRow
          title="Radar FAB"
          hint="Estrutura pronta para REDEMET/CPTEC"
          value={value.radar}
          onChange={(radar) => onChange({ ...value, radar })}
        />
      </CardContent>
    </Card>
  );
}
