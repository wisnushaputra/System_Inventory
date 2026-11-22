export interface ParsedGeoResult {
  latitude: number | null;
  longitude: number | null;
  error?: string;
}

/**
 * Mencoba memecah tempelan koordinat berpasangan seperti "-6.8915, 107.6107"
 * menjadi [latitude, longitude].
 */
export function splitCoordinatePair(raw: string): [string, string] | null {
  const parts = raw
    .trim()
    .split(/[,\s;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [parts[0], parts[1]];
}

export function parseGeoInputs(latRaw: string, lngRaw: string): ParsedGeoResult {
  const latStr = latRaw.trim();
  const lngStr = lngRaw.trim();

  if (!latStr && !lngStr) {
    return { latitude: null, longitude: null };
  }

  if (!latStr || !lngStr) {
    return {
      latitude: null,
      longitude: null,
      error: 'Latitude dan Longitude harus diisi berpasangan (atau kosongkan keduanya).',
    };
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return {
      latitude: null,
      longitude: null,
      error: 'Latitude tidak valid (harus angka antara -90 sampai 90).',
    };
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return {
      latitude: null,
      longitude: null,
      error: 'Longitude tidak valid (harus angka antara -180 sampai 180).',
    };
  }

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
  };
}

export function formatCoordinates(
  lat?: number | null,
  lng?: number | null,
  precision = 5
): string | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
