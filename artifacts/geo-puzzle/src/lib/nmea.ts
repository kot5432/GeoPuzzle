export type NmeaSatellite = {
  prn: number;
  elevation: number;
  azimuth: number;
  snr: number;
};

export type NmeaUpdate = {
  latitude?: number;
  longitude?: number;
  altitude?: number | null;
  hdop?: number | null;
  pdop?: number | null;
  vdop?: number | null;
  fixQuality?: number | null;
  satellitesUsed?: number | null;
  satellitesTotal?: number | null;
  satelliteDetails?: NmeaSatellite[];
};

function parseCoordinate(coord: string | undefined, direction: string | undefined): number | null {
  if (!coord || !direction) return null;
  const degrees = Math.floor(Number.parseFloat(coord) / 100);
  const minutes = Number.parseFloat(coord) - degrees * 100;
  const decimal = degrees + minutes / 60;
  return direction === 'S' || direction === 'W' ? -decimal : decimal;
}

function parseGga(parts: string[]): NmeaUpdate | null {
  if (parts.length < 15) return null;
  const latitude = parseCoordinate(parts[2], parts[3]);
  const longitude = parseCoordinate(parts[4], parts[5]);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    altitude: parts[9] ? Number.parseFloat(parts[9]) : null,
    fixQuality: parts[6] ? Number.parseInt(parts[6], 10) : null,
    satellitesUsed: parts[7] ? Number.parseInt(parts[7], 10) : null,
    hdop: parts[8] ? Number.parseFloat(parts[8]) : null,
  };
}

function parseRmc(parts: string[]): NmeaUpdate | null {
  if (parts.length < 7) return null;
  const latitude = parseCoordinate(parts[3], parts[4]);
  const longitude = parseCoordinate(parts[5], parts[6]);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function parseGsa(parts: string[]): NmeaUpdate | null {
  if (parts.length < 18) return null;
  return {
    pdop: parts[15] ? Number.parseFloat(parts[15]) : null,
    hdop: parts[16] ? Number.parseFloat(parts[16]) : null,
    vdop: parts[17] ? Number.parseFloat(parts[17]) : null,
    fixQuality: parts[2] ? Number.parseInt(parts[2], 10) : null,
  };
}

function parseGsv(parts: string[]): NmeaUpdate | null {
  if (parts.length < 4) return null;
  const satellitesTotal = parts[3] ? Number.parseInt(parts[3], 10) : null;
  const satelliteDetails: NmeaSatellite[] = [];
  for (let index = 4; index < parts.length - 1; index += 4) {
    if (!parts[index] || !parts[index + 1] || !parts[index + 2] || !parts[index + 3]) continue;
    satelliteDetails.push({
      prn: Number.parseInt(parts[index], 10),
      elevation: Number.parseInt(parts[index + 1], 10),
      azimuth: Number.parseInt(parts[index + 2], 10),
      snr: Number.parseInt(parts[index + 3], 10),
    });
  }
  return { satellitesTotal, satelliteDetails };
}

export function parseNmeaSentence(sentence: string): NmeaUpdate | null {
  const trimmed = sentence.trim();
  if (!trimmed.startsWith('$')) return null;
  const parts = trimmed.split(',');
  const type = parts[0]?.slice(0, 6);

  if (type === '$GPGGA' || type === '$GNGGA') return parseGga(parts);
  if (type === '$GPRMC' || type === '$GNRMC') return parseRmc(parts);
  if (type === '$GPGSA' || type === '$GNGSA' || type === '$QZQSA') return parseGsa(parts);
  if (type === '$GPGSV' || type === '$GNGSV' || type === '$QZGSV') return parseGsv(parts);
  return null;
}

export function processNmeaChunk(chunk: string, onSentence: (update: NmeaUpdate) => void) {
  for (const line of chunk.split('\n')) {
    const update = parseNmeaSentence(line);
    if (update) onSentence(update);
  }
}
