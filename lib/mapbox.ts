export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const MAP_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

export const BRAZIL_VIEW = {
  longitude: -51.2,
  latitude: -14.2,
  zoom: 3.7,
} as const;

export function hasMapboxToken() {
  return MAPBOX_TOKEN.length > 8;
}
