import type {
  MeteorologicalObservation,
  QualityFlag,
  QualityStatus,
} from "../../../../types/meteorology";

const PHYSICAL_RANGES: Record<string, [number, number]> = {
  air_temperature: [-90, 60],
  dew_point_temperature: [-100, 60],
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

    return {
      quality: "invalid",
      qualityFlags: [...new Set(flags)],
    };
  }

  const range = PHYSICAL_RANGES[observation.variable];

  if (
    range &&
    (observation.value < range[0] || observation.value > range[1])
  ) {
    flags.push("outside_physical_range");
  }

  const uniqueFlags = [...new Set(flags)];

  let quality: QualityStatus;

  if (observation.quality === "invalid") {
    quality = "invalid";
  } else if (uniqueFlags.length > 0 || observation.quality === "suspect") {
    quality = "suspect";
  } else {
    quality = "valid";
  }

  return {
    quality,
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
  const lastTimestampByStationVariable = new Map<string, number>();

  observations.forEach((observation, index) => {
    const key = [
      observation.stationId,
      observation.variable,
      observation.observedAt,
    ].join("|");

    const group = duplicateGroups.get(key) ?? [];

    group.push(index);
    duplicateGroups.set(key, group);
  });

  return observations.map((observation) => {
    const flags = [...observation.qualityFlags];

    const duplicateKey = [
      observation.stationId,
      observation.variable,
      observation.observedAt,
    ].join("|");

    if ((duplicateGroups.get(duplicateKey)?.length ?? 0) > 1) {
      flags.push("duplicate");
    }

    const stationVariableKey = [
      observation.stationId,
      observation.variable,
    ].join("|");

    const currentTimestamp = Date.parse(observation.observedAt);

    const previousTimestamp =
      lastTimestampByStationVariable.get(stationVariableKey);

    if (
      Number.isFinite(currentTimestamp) &&
      previousTimestamp !== undefined &&
      currentTimestamp < previousTimestamp
    ) {
      flags.push("timestamp_out_of_order");
    }

    if (Number.isFinite(currentTimestamp)) {
      lastTimestampByStationVariable.set(
        stationVariableKey,
        currentTimestamp,
      );
    }

    const assessed = assess({
      ...observation,
      qualityFlags: flags,
    });

    return {
      ...observation,
      ...assessed,
    };
  });
}
