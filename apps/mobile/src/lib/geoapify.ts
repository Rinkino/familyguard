// Place search on OpenStreetMap data via Geoapify. Much better than Mapbox for
// Nigerian schools, markets, malls and landmarks. Used when
// EXPO_PUBLIC_GEOAPIFY_KEY is set; otherwise search falls back to Mapbox.

import type { LatLng } from './geo';
import type { Place } from './mapbox';

const KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;
const BASE = 'https://api.geoapify.com/v1/geocode';

export const hasGeoapifyKey = Boolean(KEY);

type Result = {
  place_id: string;
  name?: string;
  formatted: string;
  address_line1?: string;
  address_line2?: string;
  lat: number;
  lon: number;
};

function toPlace(r: Result): Place {
  const name = r.name ?? r.address_line1 ?? r.formatted;
  return {
    id: r.place_id,
    name,
    address: r.address_line2 ?? r.formatted.replace(`${name}, `, ''),
    coord: { latitude: r.lat, longitude: r.lon },
  };
}

async function get(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<Result[]> {
  const res = await fetch(`${BASE}/${path}?${new URLSearchParams({ ...params, format: 'json', apiKey: KEY! })}`, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  return ((await res.json()) as { results?: Result[] }).results ?? [];
}

/** Nigeria only, nearest matches ranked first. */
export async function geoapifySearch(text: string, near: LatLng, signal?: AbortSignal): Promise<Place[]> {
  const results = await get(
    'autocomplete',
    { text, filter: 'countrycode:ng', bias: `proximity:${near.longitude},${near.latitude}`, limit: '8' },
    signal
  );
  // The same place can come back twice (e.g. a building and its amenity); keep the first.
  const seen = new Set<string>();
  return results.map(toPlace).filter((p) => {
    const key = `${p.name}|${p.coord.latitude.toFixed(4)}|${p.coord.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function geoapifyAddressAt(coord: LatLng): Promise<Place | null> {
  const [r] = await get('reverse', { lat: String(coord.latitude), lon: String(coord.longitude) });
  return r ? { ...toPlace(r), coord } : null;
}
