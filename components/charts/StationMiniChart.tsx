"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTime } from "@/lib/utils";
import type { WeatherStation } from "@/types/station";

export function StationMiniChart({ station }: { station: WeatherStation }) {
  const data = station.history.slice(-24).map((item) => ({
    time: formatTime(item.timestamp),
    temp: item.temperature,
  }));

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`temp-${station.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
            }}
            formatter={(value) => [`${Number(value).toFixed(1)} °C`, "Temp."]}
          />
          <Area
            type="monotone"
            dataKey="temp"
            stroke="#06b6d4"
            fill={`url(#temp-${station.id})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
