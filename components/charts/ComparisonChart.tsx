"use client";

import { toPng } from "html-to-image";
import { Download } from "lucide-react";
import { useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatTime } from "@/lib/utils";
import type { WeatherStation, WeatherVariable } from "@/types/station";
import { VARIABLE_LABELS, VARIABLE_UNITS } from "@/types/station";

const COLORS = ["#06b6d4", "#f59e0b", "#818cf8", "#34d399", "#f43f5e", "#fb7185"];

export function ComparisonChart({
  stations,
  variable,
  hours,
}: {
  stations: WeatherStation[];
  variable: WeatherVariable;
  hours: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const length = Math.min(hours, 72);
  const template = stations[0]?.history.slice(-length) ?? [];
  const data = template.map((point, index) => {
    const row: Record<string, string | number> = {
      time: hours > 36 ? formatDateTime(point.timestamp) : formatTime(point.timestamp),
    };
    for (const station of stations) {
      const sample = station.history.slice(-length)[index];
      row[station.id] = sample ? sample[variable] : 0;
    }
    return row;
  });

  async function exportPng() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = `clima-br-${variable}.png`;
      link.href = url;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          {VARIABLE_LABELS[variable]} ({VARIABLE_UNITS[variable]})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportPng} disabled={exporting || !stations.length}>
          <Download />
          {exporting ? "Exportando..." : "Exportar PNG"}
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="h-[360px] rounded-xl bg-card p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={28} />
              <YAxis tick={{ fontSize: 11 }} width={42} />
              <Tooltip />
              <Legend />
              {stations.map((station, index) => (
                <Line
                  key={station.id}
                  type="monotone"
                  dataKey={station.id}
                  name={`${station.city} (${station.code})`}
                  stroke={COLORS[index % COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
