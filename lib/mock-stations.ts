import { seededRandom } from "@/lib/utils";
import type {
  Region,
  StationForecast,
  StationObservation,
  StationStatus,
  StationType,
  WeatherStation,
} from "@/types/station";

interface StationSeed {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  region: Region;
  type: StationType;
  status: StationStatus;
  latitude: number;
  longitude: number;
  elevation: number;
  operator: string;
  installedAt: string;
  climate: {
    temp: number;
    humidity: number;
    pressure: number;
    rain: number;
    wind: number;
  };
}

const SEEDS: StationSeed[] = [
  {
    id: "a701",
    code: "A701",
    name: "São Paulo — Mirante de Santana",
    city: "São Paulo",
    state: "SP",
    region: "Sudeste",
    type: "automatica",
    status: "online",
    latitude: -23.4964,
    longitude: -46.62,
    elevation: 792,
    operator: "INMET",
    installedAt: "2006-12-01",
    climate: { temp: 22.4, humidity: 72, pressure: 1012, rain: 0.4, wind: 12 },
  },
  {
    id: "a602",
    code: "A602",
    name: "Rio de Janeiro — Forte de Copacabana",
    city: "Rio de Janeiro",
    state: "RJ",
    region: "Sudeste",
    type: "automatica",
    status: "online",
    latitude: -22.9883,
    longitude: -43.1906,
    elevation: 25,
    operator: "INMET",
    installedAt: "2002-05-14",
    climate: { temp: 26.1, humidity: 78, pressure: 1014, rain: 0.1, wind: 18 },
  },
  {
    id: "a001",
    code: "A001",
    name: "Brasília — INMET",
    city: "Brasília",
    state: "DF",
    region: "Centro-Oeste",
    type: "automatica",
    status: "online",
    latitude: -15.7894,
    longitude: -47.9258,
    elevation: 1159,
    operator: "INMET",
    installedAt: "2000-05-07",
    climate: { temp: 24.8, humidity: 48, pressure: 1016, rain: 0, wind: 14 },
  },
  {
    id: "a101",
    code: "A101",
    name: "Manaus — INMET",
    city: "Manaus",
    state: "AM",
    region: "Norte",
    type: "automatica",
    status: "online",
    latitude: -3.1036,
    longitude: -60.0164,
    elevation: 61,
    operator: "INMET",
    installedAt: "1998-11-02",
    climate: { temp: 31.2, humidity: 82, pressure: 1009, rain: 2.4, wind: 8 },
  },
  {
    id: "a401",
    code: "A401",
    name: "Salvador — Ondina",
    city: "Salvador",
    state: "BA",
    region: "Nordeste",
    type: "automatica",
    status: "online",
    latitude: -13.0056,
    longitude: -38.5058,
    elevation: 51,
    operator: "INMET",
    installedAt: "2003-08-20",
    climate: { temp: 27.6, humidity: 80, pressure: 1013, rain: 0.8, wind: 16 },
  },
  {
    id: "a801",
    code: "A801",
    name: "Porto Alegre — Jardim Botânico",
    city: "Porto Alegre",
    state: "RS",
    region: "Sul",
    type: "automatica",
    status: "online",
    latitude: -30.0536,
    longitude: -51.1747,
    elevation: 47,
    operator: "INMET",
    installedAt: "2001-03-12",
    climate: { temp: 18.9, humidity: 76, pressure: 1015, rain: 1.1, wind: 20 },
  },
  {
    id: "a301",
    code: "A301",
    name: "Recife — Curado",
    city: "Recife",
    state: "PE",
    region: "Nordeste",
    type: "automatica",
    status: "atrasada",
    latitude: -8.0592,
    longitude: -34.9592,
    elevation: 10,
    operator: "INMET",
    installedAt: "2004-09-18",
    climate: { temp: 28.4, humidity: 81, pressure: 1012, rain: 1.6, wind: 15 },
  },
  {
    id: "a201",
    code: "A201",
    name: "Belém — INMET",
    city: "Belém",
    state: "PA",
    region: "Norte",
    type: "automatica",
    status: "online",
    latitude: -1.4111,
    longitude: -48.4397,
    elevation: 10,
    operator: "INMET",
    installedAt: "1999-07-01",
    climate: { temp: 29.8, humidity: 86, pressure: 1010, rain: 3.2, wind: 9 },
  },
  {
    id: "a002",
    code: "A002",
    name: "Goiânia — INMET",
    city: "Goiânia",
    state: "GO",
    region: "Centro-Oeste",
    type: "automatica",
    status: "online",
    latitude: -16.6428,
    longitude: -49.2203,
    elevation: 749,
    operator: "INMET",
    installedAt: "2001-11-09",
    climate: { temp: 26.7, humidity: 52, pressure: 1014, rain: 0, wind: 13 },
  },
  {
    id: "a305",
    code: "A305",
    name: "Fortaleza — INMET",
    city: "Fortaleza",
    state: "CE",
    region: "Nordeste",
    type: "automatica",
    status: "online",
    latitude: -3.8157,
    longitude: -38.5378,
    elevation: 26,
    operator: "INMET",
    installedAt: "2002-01-22",
    climate: { temp: 28.9, humidity: 74, pressure: 1012, rain: 0.2, wind: 22 },
  },
  {
    id: "a807",
    code: "A807",
    name: "Curitiba — Pinhais",
    city: "Curitiba",
    state: "PR",
    region: "Sul",
    type: "automatica",
    status: "online",
    latitude: -25.4481,
    longitude: -49.2306,
    elevation: 923,
    operator: "INMET",
    installedAt: "2005-04-03",
    climate: { temp: 16.4, humidity: 84, pressure: 1018, rain: 0.6, wind: 11 },
  },
  {
    id: "a806",
    code: "A806",
    name: "Florianópolis — São José",
    city: "Florianópolis",
    state: "SC",
    region: "Sul",
    type: "automatica",
    status: "online",
    latitude: -27.6025,
    longitude: -48.6203,
    elevation: 5,
    operator: "INMET",
    installedAt: "2003-06-15",
    climate: { temp: 20.2, humidity: 79, pressure: 1016, rain: 0.3, wind: 17 },
  },
  {
    id: "a702",
    code: "A702",
    name: "Belo Horizonte — Pampulha",
    city: "Belo Horizonte",
    state: "MG",
    region: "Sudeste",
    type: "automatica",
    status: "online",
    latitude: -19.8839,
    longitude: -43.9694,
    elevation: 915,
    operator: "INMET",
    installedAt: "2006-02-11",
    climate: { temp: 23.1, humidity: 61, pressure: 1015, rain: 0, wind: 10 },
  },
  {
    id: "sbgr",
    code: "SBGR",
    name: "Guarulhos — Aeroporto Internacional",
    city: "Guarulhos",
    state: "SP",
    region: "Sudeste",
    type: "aeroporto",
    status: "online",
    latitude: -23.4356,
    longitude: -46.4731,
    elevation: 750,
    operator: "REDEMET / FAB",
    installedAt: "1995-01-01",
    climate: { temp: 21.8, humidity: 70, pressure: 1013, rain: 0.2, wind: 19 },
  },
  {
    id: "sbgl",
    code: "SBGL",
    name: "Galeão — Aeroporto Internacional",
    city: "Rio de Janeiro",
    state: "RJ",
    region: "Sudeste",
    type: "aeroporto",
    status: "online",
    latitude: -22.81,
    longitude: -43.2506,
    elevation: 9,
    operator: "REDEMET / FAB",
    installedAt: "1992-08-01",
    climate: { temp: 25.4, humidity: 77, pressure: 1014, rain: 0.5, wind: 21 },
  },
  {
    id: "a009",
    code: "A009",
    name: "Cuiabá — Padre Ricardo",
    city: "Cuiabá",
    state: "MT",
    region: "Centro-Oeste",
    type: "automatica",
    status: "online",
    latitude: -15.5594,
    longitude: -56.0628,
    elevation: 165,
    operator: "INMET",
    installedAt: "2007-10-19",
    climate: { temp: 32.6, humidity: 46, pressure: 1008, rain: 0, wind: 12 },
  },
  {
    id: "a702cj",
    code: "A706",
    name: "Campos do Jordão",
    city: "Campos do Jordão",
    state: "SP",
    region: "Sudeste",
    type: "convencional",
    status: "online",
    latitude: -22.75,
    longitude: -45.6039,
    elevation: 1642,
    operator: "INMET",
    installedAt: "1988-04-12",
    climate: { temp: 14.2, humidity: 88, pressure: 1021, rain: 1.8, wind: 8 },
  },
  {
    id: "a011",
    code: "A011",
    name: "Campo Grande — INMET",
    city: "Campo Grande",
    state: "MS",
    region: "Centro-Oeste",
    type: "automatica",
    status: "atrasada",
    latitude: -20.445,
    longitude: -54.5692,
    elevation: 556,
    operator: "INMET",
    installedAt: "2008-01-30",
    climate: { temp: 27.9, humidity: 55, pressure: 1011, rain: 0.1, wind: 15 },
  },
  {
    id: "a304",
    code: "A304",
    name: "Natal — INMET",
    city: "Natal",
    state: "RN",
    region: "Nordeste",
    type: "automatica",
    status: "online",
    latitude: -5.8372,
    longitude: -35.2081,
    elevation: 49,
    operator: "INMET",
    installedAt: "2003-12-08",
    climate: { temp: 27.3, humidity: 79, pressure: 1013, rain: 0.4, wind: 24 },
  },
  {
    id: "a250",
    code: "A250",
    name: "Boa Vista — INMET",
    city: "Boa Vista",
    state: "RR",
    region: "Norte",
    type: "automatica",
    status: "offline",
    latitude: 2.8161,
    longitude: -60.6956,
    elevation: 83,
    operator: "INMET",
    installedAt: "2010-06-21",
    climate: { temp: 30.4, humidity: 68, pressure: 1010, rain: 0, wind: 11 },
  },
  {
    id: "a113",
    code: "A113",
    name: "Rio Branco — INMET",
    city: "Rio Branco",
    state: "AC",
    region: "Norte",
    type: "automatica",
    status: "online",
    latitude: -9.9578,
    longitude: -67.8697,
    elevation: 160,
    operator: "INMET",
    installedAt: "2001-09-04",
    climate: { temp: 29.1, humidity: 83, pressure: 1009, rain: 2.1, wind: 7 },
  },
  {
    id: "a421",
    code: "A421",
    name: "Teresina — INMET",
    city: "Teresina",
    state: "PI",
    region: "Nordeste",
    type: "convencional",
    status: "online",
    latitude: -5.0347,
    longitude: -42.8014,
    elevation: 74,
    operator: "INMET",
    installedAt: "1996-03-18",
    climate: { temp: 33.4, humidity: 51, pressure: 1008, rain: 0, wind: 10 },
  },
  {
    id: "a652",
    code: "A652",
    name: "Vitória — INMET",
    city: "Vitória",
    state: "ES",
    region: "Sudeste",
    type: "automatica",
    status: "online",
    latitude: -20.3158,
    longitude: -40.3172,
    elevation: 36,
    operator: "INMET",
    installedAt: "2005-07-27",
    climate: { temp: 25.8, humidity: 75, pressure: 1014, rain: 0.2, wind: 16 },
  },
  {
    id: "sbbr",
    code: "SBBR",
    name: "Brasília — Aeroporto Internacional",
    city: "Brasília",
    state: "DF",
    region: "Centro-Oeste",
    type: "aeroporto",
    status: "online",
    latitude: -15.8692,
    longitude: -47.9208,
    elevation: 1060,
    operator: "REDEMET / FAB",
    installedAt: "1990-02-01",
    climate: { temp: 23.6, humidity: 50, pressure: 1017, rain: 0, wind: 18 },
  },
];

const CONDITIONS = [
  "Céu limpo",
  "Parcialmente nublado",
  "Nublado",
  "Chuva fraca",
  "Tempestade isolada",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function observation(
  seed: StationSeed,
  hoursAgo: number,
  now: Date,
): StationObservation {
  const t = now.getTime() - hoursAgo * 3600000;
  const hour = new Date(t).getHours();
  const diurnal = Math.sin(((hour - 7) / 24) * Math.PI * 2);
  const noise = (key: number) =>
    seededRandom(seed.latitude * 100 + hoursAgo * 13 + key) * 2 - 1;
  const temperature = clamp(
    seed.climate.temp + diurnal * 4.5 + noise(1) * 1.4,
    4,
    42,
  );
  const humidity = clamp(
    seed.climate.humidity - diurnal * 10 + noise(2) * 6,
    18,
    100,
  );
  const pressure = clamp(
    seed.climate.pressure + noise(3) * 2.2 - diurnal * 0.8,
    990,
    1035,
  );
  const rainChance = seed.climate.rain + Math.max(0, -diurnal) * 0.6;
  const precipitation = clamp(
    rainChance > 1.2 ? Math.max(0, rainChance + noise(4) * 1.8) : Math.max(0, rainChance * 0.25 + noise(4) * 0.2),
    0,
    28,
  );
  const windSpeed = clamp(seed.climate.wind + noise(5) * 6 + Math.abs(diurnal) * 3, 0, 70);
  const dewPoint = clamp(temperature - ((100 - humidity) / 5), -4, 28);
  return {
    timestamp: new Date(t).toISOString(),
    temperature: Number(temperature.toFixed(1)),
    humidity: Number(humidity.toFixed(0)),
    pressure: Number(pressure.toFixed(1)),
    precipitation: Number(precipitation.toFixed(1)),
    windSpeed: Number(windSpeed.toFixed(1)),
    windDirection: Math.round(seededRandom(seed.longitude * 50 + hoursAgo) * 360),
    dewPoint: Number(dewPoint.toFixed(1)),
    feelsLike: Number((temperature + (humidity > 70 ? 1.4 : -0.6)).toFixed(1)),
    visibility: Number(clamp(18 - precipitation * 1.4 + noise(6) * 2, 1, 20).toFixed(1)),
    cloudCover: Number(clamp(humidity * 0.7 + precipitation * 4 + noise(7) * 10, 0, 100).toFixed(0)),
    uvIndex: Number(clamp((diurnal > 0 ? diurnal * 10 : 0) + noise(8), 0, 12).toFixed(1)),
  };
}

function dailyFromHistory(history: StationObservation[]): StationObservation[] {
  const byDay = new Map<string, StationObservation[]>();
  for (const item of history) {
    const key = item.timestamp.slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, items]) => {
      const last = items[items.length - 1];
      const avg = (key: keyof StationObservation) =>
        items.reduce((sum, item) => sum + Number(item[key]), 0) / items.length;
      return {
        ...last,
        temperature: Number(avg("temperature").toFixed(1)),
        humidity: Number(avg("humidity").toFixed(0)),
        pressure: Number(avg("pressure").toFixed(1)),
        precipitation: Number(
          items.reduce((sum, item) => sum + item.precipitation, 0).toFixed(1),
        ),
        windSpeed: Number(avg("windSpeed").toFixed(1)),
      };
    });
}

function forecast(seed: StationSeed, now: Date): StationForecast[] {
  return Array.from({ length: 16 }, (_, index) => {
    const hours = (index + 1) * 3;
    const obs = observation(seed, -hours, now);
    const condition =
      CONDITIONS[Math.floor(seededRandom(seed.elevation + index) * CONDITIONS.length)];
    return {
      timestamp: obs.timestamp,
      temperature: obs.temperature,
      precipitation: obs.precipitation,
      humidity: obs.humidity,
      windSpeed: obs.windSpeed,
      condition,
    };
  });
}

function delayForStatus(status: StationStatus) {
  if (status === "online") return 0;
  if (status === "atrasada") return 4;
  return 18;
}

export function buildStations(now = new Date()): WeatherStation[] {
  return SEEDS.map((seed) => {
    const lag = delayForStatus(seed.status);
    const history = Array.from({ length: 72 }, (_, index) =>
      observation(seed, index + lag, now),
    ).reverse();
    const current = history[history.length - 1];
    return {
      id: seed.id,
      code: seed.code,
      name: seed.name,
      city: seed.city,
      state: seed.state,
      region: seed.region,
      type: seed.type,
      status: seed.status,
      latitude: seed.latitude,
      longitude: seed.longitude,
      elevation: seed.elevation,
      operator: seed.operator,
      installedAt: seed.installedAt,
      lastUpdate: current.timestamp,
      current,
      history,
      daily: dailyFromHistory(history),
      forecast: forecast(seed, now),
    };
  });
}

export const MOCK_STATIONS = buildStations();
