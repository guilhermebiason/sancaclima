"use client";

import type { GeoJSONSource, MapMouseEvent } from "mapbox-gl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import { LayerControls } from "@/components/map/LayerControls";
import { StationPopup } from "@/components/map/StationPopup";
import { stationsToGeoJSON } from "@/lib/api";
import { BRAZIL_VIEW, hasMapboxToken, MAP_STYLES, MAPBOX_TOKEN } from "@/lib/mapbox";
import {
  getGoesSouthAmericaOverlay,
  getRadarFabOverlay,
  type RasterOverlay,
} from "@/lib/overlay-layers";
import { HEATMAP_RANGES, type MapLayerState } from "@/types/layers";
import type { WeatherStation } from "@/types/station";
import "mapbox-gl/dist/mapbox-gl.css";

interface WeatherMapProps {
  stations: WeatherStation[];
  layers: MapLayerState;
  onLayersChange: (next: MapLayerState) => void;
}

export function WeatherMap({ stations, layers, onLayersChange }: WeatherMapProps) {
  const { resolvedTheme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [radar, setRadar] = useState<RasterOverlay | null>(null);
  const satellite = useMemo(() => getGoesSouthAmericaOverlay(), []);

  useEffect(() => {
    getRadarFabOverlay().then(setRadar);
  }, []);

  const geojson = useMemo(() => stationsToGeoJSON(stations), [stations]);
  const selected = stations.find((station) => station.id === selectedId) ?? null;
  const mapStyle = resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light;
  const heatmapRange = HEATMAP_RANGES[layers.heatmap.variable];

  const onClick = useCallback(
    (event: MapMouseEvent) => {
      const cluster = event.features?.find((feature) => feature.layer?.id === "clusters");
      if (cluster && mapRef) {
        const clusterId = Number(cluster.properties?.cluster_id);
        const source = mapRef.getSource("stations") as GeoJSONSource | undefined;
        if (!source || Number.isNaN(clusterId)) return;
        source.getClusterExpansionZoom(clusterId, (_err, zoom) => {
          const geometry = cluster.geometry as { coordinates?: [number, number] };
          if (!geometry.coordinates || zoom == null) return;
          mapRef.easeTo({ center: geometry.coordinates, zoom, duration: 500 });
        });
        return;
      }
      const point = event.features?.find((feature) => feature.layer?.id === "unclustered-point");
      const id = point?.properties?.id as string | undefined;
      setSelectedId(id ?? null);
    },
    [mapRef],
  );

  if (!hasMapboxToken()) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-3xl border border-dashed bg-muted/40 p-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="font-semibold">Token do Mapbox não configurado</p>
          <p className="text-sm text-muted-foreground">
            Crie um arquivo <code>.env.local</code> com{" "}
            <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> e reinicie o servidor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[min(78vh,820px)] min-h-[520px] overflow-hidden rounded-3xl border">
      <Map
        ref={setMapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyle}
        initialViewState={BRAZIL_VIEW}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={onClick}
        attributionControl
      >
        {layers.satellite.enabled ? (
          <Source
            id="goes-sa"
            type="raster"
            tiles={satellite.tiles}
            tileSize={satellite.tileSize}
            minzoom={satellite.minzoom}
            maxzoom={satellite.maxzoom}
            attribution={satellite.attribution}
          >
            <Layer
              id="goes-sa-layer"
              type="raster"
              paint={{ "raster-opacity": layers.satellite.opacity }}
            />
          </Source>
        ) : null}

        {layers.radar.enabled && radar ? (
          <Source
            id="radar-fab"
            type="raster"
            tiles={radar.tiles}
            tileSize={radar.tileSize}
            minzoom={radar.minzoom}
            maxzoom={radar.maxzoom}
            attribution={radar.attribution}
          >
            <Layer
              id="radar-fab-layer"
              type="raster"
              paint={{ "raster-opacity": layers.radar.opacity }}
            />
          </Source>
        ) : null}

        {layers.heatmap.enabled ? (
          <Source id="heatmap" type="geojson" data={geojson}>
            <Layer
              id="station-heatmap"
              type="heatmap"
              paint={{
                "heatmap-weight": [
                  "interpolate",
                  ["linear"],
                  ["get", layers.heatmap.variable],
                  heatmapRange.min,
                  0,
                  heatmapRange.max,
                  1,
                ],
                "heatmap-intensity": 1.15,
                "heatmap-radius": 32,
                "heatmap-opacity": layers.heatmap.opacity,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(0,0,0,0)",
                  0.2,
                  "#22d3ee",
                  0.45,
                  "#34d399",
                  0.7,
                  "#fbbf24",
                  1,
                  "#f43f5e",
                ],
              }}
            />
          </Source>
        ) : null}

        <Source
          id="stations"
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={10}
          clusterRadius={42}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#0891b2",
              "circle-radius": ["step", ["get", "point_count"], 16, 4, 20, 8, 26],
              "circle-opacity": 0.85,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ecfeff",
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
            }}
            paint={{ "text-color": "#ecfeff" }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "temperature"],
                10,
                "#38bdf8",
                20,
                "#34d399",
                28,
                "#fbbf24",
                35,
                "#f43f5e",
              ],
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
        </Source>

        {selected ? (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            maxWidth="320px"
            className="station-popup"
          >
            <StationPopup station={selected} />
          </Popup>
        ) : null}

        <NavigationControl position="bottom-right" />
      </Map>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 md:inset-x-auto md:right-auto md:left-3 md:w-[320px]">
        <div className="pointer-events-auto max-h-[70vh] overflow-y-auto">
          <LayerControls value={layers} onChange={onLayersChange} />
        </div>
      </div>
    </div>
  );
}
