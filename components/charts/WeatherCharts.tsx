"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import type { WeatherStation } from "@/types/station";

const series = [
  { key: "temperature", label: "Temperatura (°C)", color: "#f59e0b" },
  { key: "humidity", label: "Umidade (%)", color: "#22d3ee" },
  { key: "pressure", label: "Pressão (hPa)", color: "#818cf8" },
  { key: "precipitation", label: "Precipitação (mm)", color: "#38bdf8" },
  { key: "windSpeed", label: "Vento (km/h)", color: "#34d399" },
] as const;

export function WeatherCharts({ station }: { station: WeatherStation }) {
  const data = station.history.slice(-48).map((item) => ({
    time: formatTime(item.timestamp),
    temperature: item.temperature,
    humidity: item.humidity,
    pressure: item.pressure,
    precipitation: item.precipitation,
    windSpeed: item.windSpeed,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {series.map((item) => (
        <Card key={item.key}>
          <CardHeader>
            <CardTitle>{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {item.key === "precipitation" ? (
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Area type="monotone" dataKey={item.key} stroke={item.color} fill={item.color} fillOpacity={0.2} />
                </AreaChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} width={36} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey={item.key} stroke={item.color} dot={false} strokeWidth={2} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
