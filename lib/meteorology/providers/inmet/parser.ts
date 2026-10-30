import type {
  InmetHourlyRecord,
  InmetStationMetadata,
  ParsedInmetCsv,
} from "./types";

const MISSING_TOKENS = new Set(["", "null", "na", "n/a", "-9999", "9999"]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseMetadataNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMeasurement(value: string | undefined): number | null {
  const normalized = (value ?? "").trim().replace(",", ".");
  if (MISSING_TOKENS.has(normalized.toLowerCase())) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUtcTimestamp(dateValue: string, timeValue: string, line: number): string {
  const date = dateValue.trim();
  const time = timeValue.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Data inválida na linha ${line}: "${dateValue}".`);
  }

  let hour: number;
  let minute: number;
  const colonTime = /^(\d{1,2}):(\d{2})$/.exec(time);
  const compactTime = /^(\d{1,4})$/.exec(time);

  if (colonTime) {
    hour = Number(colonTime[1]);
    minute = Number(colonTime[2]);
  } else if (compactTime) {
    const padded = compactTime[1].padStart(4, "0");
    hour = Number(padded.slice(0, 2));
    minute = Number(padded.slice(2, 4));
  } else {
    throw new Error(`Hora inválida na linha ${line}: "${timeValue}".`);
  }

  if (hour > 23 || minute > 59) {
    throw new Error(`Hora fora do intervalo UTC na linha ${line}: "${timeValue}".`);
  }

  const timestamp = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString().slice(0, 10) !== date) {
    throw new Error(`Data/hora inválida na linha ${line}.`);
  }

  return timestamp.toISOString();
}

function metadataValue(metadata: Map<string, string>, key: string): string | null {
  return metadata.get(normalizeText(key)) ?? null;
}

function requiredHeaderIndex(headers: string[], predicate: (header: string) => boolean, label: string): number {
  const index = headers.findIndex((header) => predicate(normalizeText(header)));
  if (index < 0) throw new Error(`Coluna obrigatória não encontrada no CSV do INMET: ${label}.`);
  return index;
}

/**
 * Interpreta o CSV horário exportado pelo BDMEP.
 * O arquivo bruto deve ser preservado pelo chamador antes de executar o parser.
 */
export function parseInmetHourlyCsv(csvText: string): ParsedInmetCsv {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata = new Map<string, string>();
  let headerLineIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (normalizeText(line).startsWith("data medicao;")) {
      headerLineIndex = index;
      break;
    }

    const separator = line.indexOf(":");
    if (separator > 0) {
      metadata.set(
        normalizeText(line.slice(0, separator)),
        line.slice(separator + 1).trim(),
      );
    }
  }

  if (headerLineIndex < 0) {
    throw new Error("Cabeçalho tabular 'Data Medicao' não encontrado no CSV do INMET.");
  }

  const headers = lines[headerLineIndex].split(";").map((header) => header.trim());
  while (headers.length && headers[headers.length - 1] === "") headers.pop();

  const dateIndex = requiredHeaderIndex(headers, (header) => header === "data medicao", "Data Medicao");
  const timeIndex = requiredHeaderIndex(headers, (header) => header === "hora medicao", "Hora Medicao");
  const precipitationIndex = requiredHeaderIndex(headers, (header) => header.includes("precipitacao total"), "precipitação horária");
  const radiationIndex = requiredHeaderIndex(headers, (header) => header.includes("radiacao global"), "radiação global");
  const temperatureIndex = requiredHeaderIndex(headers, (header) => header.includes("temperatura do ar") && header.includes("bulbo seco"), "temperatura do ar");
  const humidityIndex = requiredHeaderIndex(headers, (header) => header.includes("umidade relativa"), "umidade relativa");
  const directionIndex = requiredHeaderIndex(headers, (header) => header.includes("vento") && header.includes("direcao"), "direção do vento");
  const speedIndex = requiredHeaderIndex(headers, (header) => header.includes("vento") && header.includes("velocidade"), "velocidade do vento");

  const name = metadataValue(metadata, "Nome");
  const code = metadataValue(metadata, "Codigo Estacao");
  const latitude = parseMetadataNumber(metadataValue(metadata, "Latitude") ?? undefined);
  const longitude = parseMetadataNumber(metadataValue(metadata, "Longitude") ?? undefined);
  const elevationMeters = parseMetadataNumber(metadataValue(metadata, "Altitude") ?? undefined);

  if (!name || !code || latitude === null || longitude === null) {
    throw new Error("Metadados obrigatórios ausentes: Nome, Codigo Estacao, Latitude ou Longitude.");
  }

  const station: InmetStationMetadata = {
    name,
    code,
    latitude,
    longitude,
    elevationMeters,
    situation: metadataValue(metadata, "Situacao"),
    startDate: metadataValue(metadata, "Data Inicial"),
    endDate: metadataValue(metadata, "Data Final"),
    measurementPeriodicity: metadataValue(metadata, "Periodicidade da Medicao"),
  };

  const records: InmetHourlyRecord[] = [];
  for (let index = headerLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const cells = line.split(";").map((cell) => cell.trim());
    if (cells.length <= Math.max(dateIndex, timeIndex)) continue;
    if (!cells[dateIndex] && !cells[timeIndex]) continue;

    const sourceLine = index + 1;
    const observedAt = parseUtcTimestamp(cells[dateIndex], cells[timeIndex], sourceLine);
    records.push({
      observedAt,
      sourceLine,
      values: {
        precipitation: parseMeasurement(cells[precipitationIndex]),
        solarRadiation: parseMeasurement(cells[radiationIndex]),
        airTemperature: parseMeasurement(cells[temperatureIndex]),
        relativeHumidity: parseMeasurement(cells[humidityIndex]),
        windDirection: parseMeasurement(cells[directionIndex]),
        windSpeed: parseMeasurement(cells[speedIndex]),
      },
    });
  }

  if (records.length === 0) throw new Error("O CSV do INMET não contém registros horários.");

  return { station, records, sourceHeaders: headers };
}
