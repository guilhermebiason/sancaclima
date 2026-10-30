import type {
  MeteorologicalObservation,
  QualityFlag,
  QualityStatus,
} from "../../../../types/meteorology";

const PHYSICAL_RANGES: Record<string, [number, number]> = {
  air_temperature: [-90, 60],
  relative_humidity: [0, 100],
  precipitation: [0, 500],
  solar_radiation: [0, 5000],
  wind_speed: [0, 75],
  wind_direction: [0, 360],
};

function assess(
  observation: MeteorologicalObservation,
): { quality: QualityStatus; qualityFlags: QualityFlag[] } {
  const flags = [...observation.qualityFlags];

  if (observation.value === null) {
    flags.push("missing_value");
    return { quality: "invalid", qualityFlags: [...new Set(flags)] };
  }

  const range = PHYSICAL_RANGES[observation.variable];
  if (range && (observation.value < range[0] || observation.value > range[1])) {
    flags.push("outside_physical_range");
  }

  const uniqueFlags = [...new Set(flags)];
  return {
    quality: uniqueFlags.length > 0 ? "suspect" : "valid",
    qualityFlags: uniqueFlags,
  };
}

/**
 * Aplica verificações preliminares sem apagar ou corrigir valores de origem.
 * Os limites são filtros amplos de plausibilidade, não uma validação climatológica.
 */
export function applyInmetQualityControl(
  observations: MeteorologicalObservation[],
): MeteorologicalObservation[] {
  const duplicateGroups = new Map<string, number[]>();
  const lastTimestampByVariable = new Map<string, string>();

  observations.forEach((observation, index) => {
    const key = `${observation.stationId}|${observation.variable}|${observation.observedAt}`;
    const group = duplicateGroups.get(key) ?? [];
    group.push(index);
    duplicateGroups.set(key, group);
  });

  return observations.map((observation) => {
    const flags = [...observation.qualityFlags];
    const key = `${observation.stationId}|${observation.variable}|${observation.observedAt}`;
    if ((duplicateGroups.get(key)?.length ?? 0) > 1) flags.push("duplicate");

    const previousTimestamp = lastTimestampByVariable.get(observation.variable);
    if (previousTimestamp && observation.observedAt < previousTimestamp) {
      flags.push("timestamp_out_of_order");
    }
    lastTimestampByVariable.set(observation.variable, observation.observedAt);

    const assessed = assess({ ...observation, qualityFlags: flags });
    return { ...observation, ...assessed };
  });
}
