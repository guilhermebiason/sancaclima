import { MOCK_STATIONS } from "@/lib/mock-stations";
import type { WeatherStation } from "@/types/station";

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchStations(): Promise<WeatherStation[]> {
  await delay();
  return MOCK_STATIONS;
}

export async function fetchStationById(id: string): Promise<WeatherStation | null> {
  await delay();
  return MOCK_STATIONS.find((station) => station.id === id) ?? null;
}

export function stationsToGeoJSON(stations: WeatherStation[]) {
  return {
    type: "FeatureCollection" as const,
    features: stations.map((station) => ({
      type: "Feature" as const,
      id: station.id,
      properties: {
        id: station.id,
        name: station.name,
        code: station.code,
        status: station.status,
        type: station.type,
        region: station.region,
        temperature: station.current.temperature,
        humidity: station.current.humidity,
        pressure: station.current.pressure,
        precipitation: station.current.precipitation,
        windSpeed: station.current.windSpeed,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [station.longitude, station.latitude],
      },
    })),
  };
}
