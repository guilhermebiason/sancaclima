/**
 * Camadas raster públicas, com a mesma estrutura que uma integração
 * REDEMET / CPTEC / FAB deve preencher (URL de tiles + metadados).
 */

export interface RasterOverlay {
  id: string;
  name: string;
  description: string;
  tiles: string[];
  tileSize: number;
  minzoom: number;
  maxzoom: number;
  attribution: string;
}

function roundGoesTime(date = new Date()) {
  const d = new Date(date);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0);
  d.setUTCMilliseconds(0);
  return d.toISOString().replace(".000Z", "Z");
}

export function getGoesSouthAmericaOverlay(date = new Date()): RasterOverlay {
  const time = roundGoesTime(date);
  return {
    id: "goes-sa",
    name: "Satélite GOES — América do Sul",
    description:
      "GeoColor GOES-East (ABI) via NASA GIBS. Substituível por CPTEC/INPE.",
    tiles: [
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/${time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    ],
    tileSize: 256,
    minzoom: 1,
    maxzoom: 9,
    attribution: "NASA GIBS / NOAA GOES-East",
  };
}

interface RainViewerMaps {
  host: string;
  radar?: {
    past?: { path: string; time: number }[];
    nowcast?: { path: string; time: number }[];
  };
}

export async function getRadarFabOverlay(): Promise<RasterOverlay> {
  try {
    const response = await fetch(
      "https://api.rainviewer.com/public/weather-maps.json",
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("RainViewer indisponível");
    const data = (await response.json()) as RainViewerMaps;
    const latest = data.radar?.past?.at(-1);
    if (!latest) throw new Error("Sem frames de radar");
    return {
      id: "radar-fab",
      name: "Radar meteorológico (FAB / REDEMET)",
      description:
        "Overlay público compatível com tiles XYZ. Troque `tiles` pelo endpoint da REDEMET/FAB quando a chave estiver disponível.",
      tiles: [
        `https://${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
      ],
      tileSize: 256,
      minzoom: 1,
      maxzoom: 7,
      attribution: "RainViewer / redes públicas de radar",
    };
  } catch {
    return {
      id: "radar-fab",
      name: "Radar meteorológico (placeholder)",
      description:
        "Placeholder até o endpoint REDEMET/FAB. A estrutura de Source/Layer já está pronta.",
      tiles: [
        "https://tilecache.rainviewer.com/v2/radar/0/256/{z}/{x}/{y}/2/1_1.png",
      ],
      tileSize: 256,
      minzoom: 1,
      maxzoom: 7,
      attribution: "Camada de radar (exemplo)",
    };
  }
}
