"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchStations } from "@/lib/api";
import type { WeatherStation } from "@/types/station";

interface StationsContextValue {
  stations: WeatherStation[];
  loading: boolean;
  error: string | null;
  highlights: {
    hottest: WeatherStation;
    coldest: WeatherStation;
    wettest: WeatherStation;
    windiest: WeatherStation;
  } | null;
}

const StationsContext = createContext<StationsContextValue | null>(null);

export function StationsProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchStations()
      .then((data) => {
        if (active) setStations(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar as estações.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const highlights = useMemo(() => {
    if (!stations.length) return null;
    const hottest = [...stations].sort(
      (a, b) => b.current.temperature - a.current.temperature,
    )[0];
    const coldest = [...stations].sort(
      (a, b) => a.current.temperature - b.current.temperature,
    )[0];
    const wettest = [...stations].sort(
      (a, b) => b.current.precipitation - a.current.precipitation,
    )[0];
    const windiest = [...stations].sort(
      (a, b) => b.current.windSpeed - a.current.windSpeed,
    )[0];
    return { hottest, coldest, wettest, windiest };
  }, [stations]);

  const value = useMemo(
    () => ({ stations, loading, error, highlights }),
    [stations, loading, error, highlights],
  );

  return createElement(StationsContext.Provider, { value }, children);
}

export function useStations() {
  const context = useContext(StationsContext);
  if (!context) {
    throw new Error("useStations deve ser usado dentro de StationsProvider");
  }
  return context;
}
