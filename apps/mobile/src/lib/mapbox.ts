// Search, pin addresses and directions. Directions always come from Mapbox.
// Search and pin addresses use Geoapify (OpenStreetMap) when its key is set,
// because it covers Nigerian places far better; otherwise Mapbox. Without any
// key, search falls back to sample Lagos places.

import { mockPlaces } from '@/mock/places';
import { distanceMeters, type LatLng } from './geo';
import { geoapifyAddressAt, geoapifySearch, hasGeoapifyKey } from './geoapify';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const BASE = 'https://api.mapbox.com';

export const hasMapboxToken = Boolean(TOKEN);

export type Place = { id: string; name: string; address: string; coord: LatLng };

export type TravelMode = 'walking' | 'driving' | 'cycling';

export type Route = {
  coords: LatLng[];
  distanceM: number;
  durationS: number;
  mode: TravelMode;
};

type GeocodeFeature = {
  id: string;
  properties: {
    name: string;
    full_address?: string;
    place_formatted?: string;
    coordinates: { latitude: number; longitude: number };
  };
};

function toPlace(f: GeocodeFeature): Place {
  return {
    id: f.id,
    name: f.properties.name,
    address: f.properties.full_address ?? f.properties.place_formatted ?? '',
    coord: { latitude: f.properties.coordinates.latitude, longitude: f.properties.coordinates.longitude },
  };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Mapbox request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export async function searchPlaces(query: string, near: LatLng, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  if (hasGeoapifyKey) return geoapifySearch(q, near, signal);
  if (!TOKEN) {
    const lower = q.toLowerCase();
    return mockPlaces.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(lower)).slice(0, 6);
  }
  const params = new URLSearchParams({
    q,
    proximity: `${near.longitude},${near.latitude}`,
    country: 'ng',
    limit: '6',
    access_token: TOKEN,
  });
  const data = await getJson<{ features: GeocodeFeature[] }>(`${BASE}/search/geocode/v6/forward?${params}`, signal);
  return data.features.map(toPlace);
}

export async function addressAt(coord: LatLng): Promise<Place> {
  const fallback: Place = {
    id: `pin-${coord.latitude.toFixed(5)},${coord.longitude.toFixed(5)}`,
    name: 'Dropped pin',
    address: `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
    coord,
  };
  if (hasGeoapifyKey) {
    try {
      const p = await geoapifyAddressAt(coord);
      if (p) return { ...p, id: fallback.id };
    } catch {
      // fall through to Mapbox
    }
  }
  if (!TOKEN) {
    const nearest = [...mockPlaces].sort((a, b) => distanceMeters(a.coord, coord) - distanceMeters(b.coord, coord))[0];
    return nearest && distanceMeters(nearest.coord, coord) < 600
      ? { ...fallback, name: `Near ${nearest.name}`, address: nearest.address }
      : fallback;
  }
  const params = new URLSearchParams({
    longitude: String(coord.longitude),
    latitude: String(coord.latitude),
    access_token: TOKEN,
  });
  try {
    const data = await getJson<{ features: GeocodeFeature[] }>(`${BASE}/search/geocode/v6/reverse?${params}`);
    const f = data.features[0];
    return f ? { ...toPlace(f), id: fallback.id, coord } : fallback;
  } catch {
    return fallback;
  }
}

export async function getRoute(from: LatLng, to: LatLng, mode: TravelMode): Promise<Route> {
  if (!TOKEN) return mockRoute(from, to, mode);
  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const params = new URLSearchParams({ geometries: 'geojson', overview: 'full', access_token: TOKEN });
  const data = await getJson<{
    routes: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  }>(`${BASE}/directions/v5/mapbox/${mode}/${path}?${params}`);
  const r = data.routes[0];
  if (!r) throw new Error('No route found between these places');
  return {
    coords: r.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    distanceM: r.distance,
    durationS: r.duration,
    mode,
  };
}

// A gently bent line so mock routes don't look like a ruler was used.
function mockRoute(from: LatLng, to: LatLng, mode: TravelMode): Route {
  const steps = 24;
  const dLat = to.latitude - from.latitude;
  const dLng = to.longitude - from.longitude;
  const coords = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const bend = Math.sin(t * Math.PI) * 0.18;
    return { latitude: from.latitude + dLat * t - dLng * bend, longitude: from.longitude + dLng * t + dLat * bend };
  });
  const distanceM = distanceMeters(from, to) * 1.3;
  const speed = { walking: 1.3, cycling: 4.5, driving: 7 }[mode]; // m/s, Lagos traffic
  return { coords, distanceM, durationS: distanceM / speed, mode };
}
